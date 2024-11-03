import Redis, {RedisOptions } from "ioredis";
import { commands } from "vscode";
import * as vs from "vscode";
import * as os from  'os';
import { LockCommands, LockState, channelID } from "./conts";
import { Tag,LockMessage } from "./types";
import { logger } from "./logger";

export class Storage {
    private sub:Redis;
    private pub:Redis;
    private tag:Tag;

    _onDidLockChanged:vs.EventEmitter<LockMessage[]>;

    get onDidLockChanged() {
        return this._onDidLockChanged.event;
    }

    getTag() {
        const {username} = os.userInfo();
        return {
            username,
            host:os.hostname(),
        };
    }

    constructor(_ctx:vs.ExtensionContext) {        
        
        const host = vs.workspace.getConfiguration().get("redisHost") as string;
        const port = parseInt(vs.workspace.getConfiguration().get("redisPort")!);
        const db   = parseInt(vs.workspace.getConfiguration().get("redisDB")!);
        const username = vs.workspace.getConfiguration().get("redisUsername") as string;
        const password = vs.workspace.getConfiguration().get("resisPassword") as string;
        const connectOpts : RedisOptions = {
            host,port,db,username,password,
            connectionName:"SHLCK",
        };

        console.log("Config",connectOpts);

        this._onDidLockChanged = new vs.EventEmitter<LockMessage[]>();
        this.tag = this.getTag();
        this.sub = new Redis(connectOpts);
        this.pub = new Redis(connectOpts);
        this.sub.on("connect",()=>{
            console.log("*** CONNECTED ****");
            logger.info(`[redis]: Connection made to ${host}:${port} with auth ${username}/${password}`);
            this.sub.subscribe(channelID,(err,count) => {
                if ( err ){
                    logger.error(`[redis] Failed to subscribe to channed ${channelID}`,err.message);
                    console.error("Cannot subscribe !",err);
                } else { 
                    logger.info(`[redis] Message bus started on ${channelID}`);
                    console.log("Subscribed",count);
                }
            });
            this.sub.on("message",(channel,msg)=>{
                this.onMessage(JSON.parse(msg));
            });            
        });
        this.sub.on("error",(e)=>{
            logger.error(`[redis]: ${e.name}:${e.message}`);
        });
        vs.window.onDidChangeActiveTextEditor((_e)=>{
            this.setTabStatus();
        });
    }

    async setContext(file?:string) {
        const key = file || (await this.getFileTag());
        if ( key ) {
            const check = await this.get(key);
            const locked = check;
            const isOwner = locked && this.isMe(check);
            vs.commands.executeCommand('setContext','sharedlock.state',locked ? 'locked':'unlocked');
            vs.commands.executeCommand('setContext','sharedlock.isOwner',isOwner);
            console.log(`Set context: ${key}`,locked);
        }
    }

    async setTabStatus() {
        const key = await this.getFileTag();
        if ( !key ) {
            return;
        }
        const check = await this.get(key);
        if ( check ) {
            if ( this.isMe(check) ) {
                commands.executeCommand(LockCommands.updateLock,LockState.Owned,{tag:check});
                commands.executeCommand('workbench.action.files.setActiveEditorWriteableInSession');
            } else {
                commands.executeCommand(LockCommands.updateLock,LockState.Locked,{tag:check});
                commands.executeCommand('workbench.action.files.setActiveEditorReadonlyInSession');
            }
        } else {
            commands.executeCommand('workbench.action.files.setActiveEditorWriteableInSession');
            commands.executeCommand(LockCommands.updateLock,LockState.Unlocked);
        }
        this.setContext(key);
    }

    async onMessage(msg:LockMessage) {
        console.log("LOCKED MESSAGE !",msg);
        logger.debug('[redis]: Message',msg);
        const key = await this.getFileTag();
        if ( key === msg.file ) {
            if ( msg.state == LockState.Locked ) {
                await commands.executeCommand(LockCommands.updateLock,this.isMe(msg.tag) ? LockState.Owned : LockState.Locked,msg);
            } else {
                await commands.executeCommand(LockCommands.updateLock,msg.state,msg);
            }
        }
        this.informLocksChanges();
    }

    public get locks() : Thenable<LockMessage[]> {
        return this.pub.keys("*")
        .then((keys)=>{
            return Promise.all(
                keys.map(file => this.get(file).then((tag) => ({file,tag,state:this.isMe(tag!) ? LockState.Owned : LockState.Locked}) as LockMessage))            
            );
        });
    }

    async wipeLocked() {
        const data = await this.locks;
        const wiped = data.filter(m => this.isMe(m.tag));
        wiped.forEach((m)=>{
            this.pub.del(m.file);
            this.pub.publish("ch1",JSON.stringify({state:LockState.Unlocked,file:m.file,tag:m.tag}));
        });
        logger.info(`Wiped ${wiped.length} locksa`);
    }

    async ctxUnlock(msg:LockMessage) {
        await this.del(msg.file);
        this.pub.publish("ch1",JSON.stringify({state:LockState.Unlocked,file:msg.file,tag:msg.tag}));
    }

    async informLocksChanges() {
        const data = await this.pub.keys("*")
        .then((keys)=>{
            return Promise.all(
                keys.map(file => this.get(file).then((tag) => ({file,tag}) as LockMessage))
            
            );
        });
        this._onDidLockChanged.fire(data);
    }

    set(key:string,obj:Tag) {
        logger.debug(`Locking file ${key}`);
        return this.pub.set(key,JSON.stringify(obj));
    }

    get(key:string) {
        return this.pub.get(key)
        .then((res:string | null)=>{
            if ( res ) {
                return JSON.parse(res) as Tag;
            }
            return null;
        });
    }

    del(key:string) {
        logger.debug(`Release file ${key}`);
        return this.pub.del(key);
    }

    exists(key:string) {
        return this.pub.exists(key);
    }

    publish(obj:object) {
        logger.debug(`[redis]: Publish`,obj);
        this.pub.publish(channelID,JSON.stringify(obj));
    }

    isMe(tag:Tag) {
        return this.tag.host === tag.host && this.tag.username === tag.username;
    }

    async setFileLockState(state:LockState) {
        const key = await this.getFileTag();
        console.log("Lock state for",key,state);
        if ( !key ) {
            return;
        }
        if ( state == LockState.Locked ) {
            this.set(key,this.tag);
        } else {
            this.del(key);
        }
        this.publish({state,file:key,tag:this.tag});
        this.setContext();
    }


    async toggleLock() {
        const key = await this.getFileTag();
        if ( !key ) {
            return;
        }
        const check = await this.get(key);
        if (!check) {
            this.setFileLockState(LockState.Locked);
        } else {
            if ( this.isMe(check)) {
                this.setFileLockState(LockState.Unlocked);
            } else {
                vs.window.showInformationMessage(`File is locked by ${check.username}`);                
            }
        }
    }

    async getFileTag() {
        if ( !vs.window.activeTextEditor ) {
            return;
        }
        const {uri} = vs.window.activeTextEditor.document;
        if ( uri.scheme !== 'file' ) {
            return;
        }
        const key = vs.workspace.asRelativePath(uri!,false);
        return key;
        // this.getGIT(uri);
        /*
        const levelUp = async (dir:string) => {
            try {
                const dotGit = path.join(dir,".git");
                const dotGitStat = await new Promise<fs.Stats>((c, e) => fs.stat(dotGit, (err, stat) => err ? e(err) : c(stat)));
                if ( dotGitStat.isDirectory() ) {
                    const p = dir.split(path.sep);
                    p.pop();
                    return path.join(path.sep,...p);
                }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (e) { /* empty  }
            const parts = dir.split(path.sep);            
            if ( parts.length > 1 ) {                
                parts.pop();
                const prevPath = path.join(path.sep,...parts);
                return levelUp(prevPath);
            }
            return null;
        };
        */
        /*
        const p = path.parse(uri.fsPath);
        const found = await levelUp(p.dir);
        if ( found ) {
            const key = uri.fsPath.substring(found.length);
            const base = uri.fsPath.substring(0,found.length);
            console.log("FILE TAG",{key,base});
            return {key,base};
        }
        */
    }

    /*
    async getGIT(file:vs.Uri) {
        const gitExtension = vs.extensions?.getExtension<GitExtension>('vscode.git')?.exports;
        const git = gitExtension?.getAPI(1);
        const repo = git?.getRepository(file);
        const {HEAD,workingTreeChanges,untrackedChanges,remotes} = repo!.state;
        console.log("STATE",{
            HEAD,
            workingTreeChanges,
            untrackedChanges,
            remotes
        });
        repo?.getBranches({remote:true})
        .then((list)=>{
            console.log("Branches",list);
        })
        console.log("REPO",await repo?.status());
        /*
        vs.workspace.workspaceFolders?.forEach((f)=>{
            console.log("WORKSPACES",f.name,f.uri);
            const repo = git?.getRepository(f.uri);
            console.log("GOT REPO !",repo);
            // console.log("STATE",repo?.state.HEAD,repo?.state.remotes);
            
            repo?.status()
            .then((s)=>{
                console.log("STATUS",s);
            });
            repo?.getConfigs()
            .then((cfg)=>{
                console.log(`>>>>>>>>>>>>>>>>> ${f.uri}`,cfg);
            });
        });
    }
    */

    public dispose() {
        console.log("Killing connection");
        this.pub.disconnect(false);
        this.sub.disconnect(false);
    }
}