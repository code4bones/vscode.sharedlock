import Redis, {RedisOptions } from "ioredis";
import { commands } from "vscode";
import * as vs from "vscode";
import * as os from  'os';
import * as path from 'path';
import { LockCommands, LockState, channelID, channelUI } from "./conts";
import { Tag,LockMessage, UIMessage, UIMessageType, UILockRequestMessage, UILockReplyMessage } from "./types";
import { logger } from "./logger";
import { existsSync } from "fs";
import { getPathNS } from "./utils";

export class Storage {
    private sub:Redis;
    private pub:Redis;
    private tag:Tag;
    private _ns?:string;
    private ctx:vs.ExtensionContext;
    private folders:string[];
    private _enabled:boolean;
    private userChannel:string;

    _onDidLockChanged:vs.EventEmitter<LockMessage[]>;
    _onDidEnabledChanged:vs.EventEmitter<boolean>;

    get onDidLockChanged() {
        return this._onDidLockChanged.event;
    }

    get onDidEnabledChanged() {
        return this._onDidEnabledChanged.event;
    }

    getTag() {
        const {username} = os.userInfo();
        return {
            username,
            host:os.hostname(),
        };
    }

    constructor(_ctx:vs.ExtensionContext) {        
        this.ctx = _ctx;

        this._onDidLockChanged = new vs.EventEmitter<LockMessage[]>();
        this._onDidEnabledChanged = new vs.EventEmitter<boolean>();

        this._enabled = false;
        this.folders = JSON.parse(this.ctx.globalState.get("roots")!);         
        const host = vs.workspace.getConfiguration().get("redisHost") as string;
        const port = parseInt(vs.workspace.getConfiguration().get("redisPort")!);
        const db   = parseInt(vs.workspace.getConfiguration().get("redisDB")!);
        const username = vs.workspace.getConfiguration().get("redisUsername") as string;
        const password = vs.workspace.getConfiguration().get("resisPassword") as string;
        const connectOpts : RedisOptions = {
            host,port,db,username,password,
            connectionName:"SHLCK",
        };

        console.log("Config",connectOpts,this.folders);

        this.tag = this.getTag();
        this.userChannel = `${channelUI}.${this.tag.username}`;
        this.sub = new Redis(connectOpts);
        this.pub = new Redis(connectOpts);
        this.sub.on("connect",()=>{
            let txt = `[redis]: Connection made to ${host}:${port}/${db} with auth ${username || '-'}/${password ||'-'}`;
            console.log(txt);
            logger.info(txt);
            this.sub.subscribe(channelID,this.userChannel,(err,count) => {
                if ( err ){
                    txt = `[redis] Failed to subscribe to channels ${channelID}: ${err.message}`;
                    logger.error(txt);
                    console.error(txt,err);
                } else { 
                    txt = `[redis] Message bus started on ${channelID}/${this,this.userChannel} ( count ${count})`;
                    logger.info(txt);
                    console.log(txt);
                    this.startup();
                }
            });
            this.sub.on("message",(channel,msg)=>{
                if ( channel === channelID ) {
                    this.onMessage(JSON.parse(msg));
                } else {
                    this.onUIMessage(JSON.parse(msg));
                }
            });            
        });
        this.sub.on("error",(e)=>{
            logger.error(`[redis]: ${e.name}:${e.message}`);
            this.enabled = false;
        });
    }

    startup() {
        this.enabled = true;
        vs.window.onDidChangeActiveTextEditor((e)=>{
            if ( !e?.document ) {
                return;
            }
            const ns = this.ns;           
            if ( this._ns !== ns ) {
                this._ns = ns;
                this.informLocksChanges();
            }
            this.setTabStatus();
        });
    }

    set enabled(hasGit:boolean) {
        if ( this._enabled !== hasGit ) { 
            this._enabled = hasGit;
            vs.commands.executeCommand('setContext','sharedlock.hasGit',hasGit)
            .then(()=>{
                this._onDidEnabledChanged.fire(hasGit);
            });
        }
    }

    get enabled() {
        return this._enabled;
    }

    async setContext(file?:string,aCheck?:Tag | null) {
        const key = file || (await this.getFileTag());
        if ( key ) {
            const check = aCheck || (await this.get(key));
            const locked = check;
            const isOwner = locked && this.isMe(check);
            await Promise.all([
                vs.commands.executeCommand('setContext','sharedlock.state',locked ? 'locked':'unlocked'),
                vs.commands.executeCommand('setContext','sharedlock.isOwner',isOwner)]);
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
                await Promise.all([
                    commands.executeCommand(LockCommands.updateLock,LockState.Owned,{tag:check}),
                    commands.executeCommand('workbench.action.files.setActiveEditorWriteableInSession')]);
            } else {
                await Promise.all([
                    commands.executeCommand(LockCommands.updateLock,LockState.Locked,{tag:check}),
                    commands.executeCommand('workbench.action.files.setActiveEditorReadonlyInSession')]);
            }
        } else {
            await Promise.all([commands.executeCommand('workbench.action.files.setActiveEditorWriteableInSession'),
                               commands.executeCommand(LockCommands.updateLock,LockState.Unlocked)]);
        }
        await this.setContext(key,check);
    }

    async onUIMessage(msg:UIMessage) {
        logger.info(`UI Message from ${msg.from.username}: ${msg.message}`);
        console.log("UI",msg);
        switch ( msg.type ) {
            case UIMessageType.lockRequest:
                vs.window.showWarningMessage(`👤 ${msg.from.username} • ${msg.message}`,{},...["Unlock!"])
                .then(async (res)=>{
                    console.log(res);
                    if ( res ) {
                        await this.setFileLockState(LockState.Unlocked,(msg as UILockRequestMessage).payload.file);
                    }
                    this.uiPub(msg.from,{
                        type:UIMessageType.lockReply,
                        message:res ? "Accepted"  : "Rejected...",
                        from:this.tag,
                        payload:{
                            file:(msg as UILockRequestMessage).payload.file,
                            granted:Boolean(res)
                        }
                    });
                });
                break;
            case UIMessageType.lockReply:
                if ( (msg as UILockReplyMessage).payload.granted ) {
                    vs.window.showWarningMessage(`${msg.message} 👤 ${msg.from.username}`);
                    await this.setFileLockState(LockState.Locked,(msg as UILockReplyMessage).payload.file);
                } else {
                    vs.window.showErrorMessage(`${msg.message} 👤 ${msg.from.username}`);
                }
                break;
        }
    }

    async onMessage(msg:LockMessage) {
        console.log("LOCKED MESSAGE !",msg);
        logger.debug('[redis]: Message',msg);
        const key = await this.getFileTag();
        if ( key && this.nsKey(key) === msg.file ) {
            if ( msg.state == LockState.Locked ) {
                await commands.executeCommand(LockCommands.updateLock,this.isMe(msg.tag) ? LockState.Owned : LockState.Locked,msg);
            } else {
                await commands.executeCommand(LockCommands.updateLock,msg.state,msg);
            }
        }
        this.informLocksChanges();
    }

    public get locks() : Thenable<LockMessage[]> {
        return this.keys()
        .then((keys)=>{
            return Promise.all(
                keys.map(file => this.getVal(file).then((tag) => ({file,tag,state:this.isMe(tag!) ? LockState.Owned : LockState.Locked}) as LockMessage))            
            );
        });
    }

    async wipeLocked() {
        const data = await this.locks;
        const wiped = data.filter(m => this.isMe(m.tag));
        wiped.forEach((m)=>{
            this.pub.del(m.file)
            .then(()=>{
                this.publish({state:LockState.Unlocked,file:m.file,tag:m.tag});
            });
        });
        logger.info(`Wiped ${wiped.length} locks`);
    }

    async ctxUnlock(msg:LockMessage) {
        await this.pub.del(msg.file);
        this.publish({state:LockState.Unlocked,file:msg.file,tag:msg.tag});
    }

    async informLocksChanges() {
        const data = await this.keys()
        .then((keys)=>{
            return Promise.all(
                keys.map(file => this.getVal(file).then((tag) => ({file,tag}) as LockMessage))
            
            );
        });
        this._onDidLockChanged.fire(data);
        // this.setContext();
    }

    keys() {
        return this.pub.keys(`${this.ns}:*`);
    }

    set(key:string,obj:Tag) {
        if ( !this.enabled ) {
            return;
        }
        const nskey = this.nsKey(key);
        logger.debug(`Locking file ${nskey}`);
        return this.pub.set(nskey,JSON.stringify(obj));
    }

    getVal(key:string) {
        if (!this.enabled ) {
            return Promise.resolve(null);
        }
        return this.pub.get(key)
        .then((res:string | null)=>{
            if ( res ) {
                return JSON.parse(res) as Tag;
            }
            return null;
        });
    }

    get(key:string) {
        return this.pub.get(this.nsKey(key))
        .then((res:string | null)=>{
            if ( res ) {
                return JSON.parse(res) as Tag;
            }
            return null;
        });
    }

    del(key:string) {
        if (!this.enabled ) {
            return;
        }
        const nskey = this.nsKey(key);
        logger.debug(`Release file ${nskey}`);
        return this.pub.del(nskey);
    }

    exists(key:string) {
        if (!this.enabled ) {
            return;
        }
        return this.pub.exists(this.nsKey(key));
    }

    publish(obj:object) {
        logger.debug(`[redis]: Publish`,obj);
        return this.pub.publish(channelID,JSON.stringify(obj));
    }

    isMe(tag:Tag) {
        return this.tag.host === tag.host && this.tag.username === tag.username;
    }

    async setFileLockState(state:LockState,aKey?:string | undefined) {
        const key = aKey || (await this.getFileTag());
        console.log("Lock state for",key,state);
        if ( !key ) {
            return;
        }
        if ( state == LockState.Locked ) {
            await this.set(key,this.tag);
        } else {
            await this.del(key);
        }
        await this.publish({state,file:this.nsKey(key),tag:this.tag});
        await this.setContext();
    }

    async lockGroup(files:string[]) {
        if ( !files?.length ) {
            vs.window.showInformationMessage(`Nothing to lock...`);
            return;
        }
        const [oneFile] = files;
        const ns = getPathNS(oneFile,this.folders);
        const pendings = files.map((file)=>{
            const uri = vs.Uri.parse(file);
            const root = this.getRoot(uri);
            if ( root ) {
                const key = uri!.path.substring(root!.length);
                const tkey = `${ns}:${key}`;
                return this.pub.exists(tkey)
                .then((ignore)=>{
                    if ( !ignore ) {
                        logger.info(`[${ns}] Locked [${key}]`);
                        console.log(`KEYED ${tkey}`);
                        return this.setFileLockState(LockState.Locked,key);
                    } else {
                        logger.warn(`[${ns}] Skipped: ${key}`);
                        console.log("**** SKIPPED",tkey);
                    }
                });
            } 
        });
        await Promise.all(pendings)
        .then(async ()=>{
            // await this.informLocksChanges();
            vs.window.showInformationMessage(`${files.length} file(s) are owned`);
        });
    }

    async toggleLock() {
        const key = await this.getFileTag();
        if ( !key ) {
            return;
        }
        const check = await this.get(key);
        if (!check) {
           await  this.setFileLockState(LockState.Locked);
        } else {
            if ( this.isMe(check)) {
                await this.setFileLockState(LockState.Unlocked);
            } else {
                const opts : vs.MessageOptions = {
                    modal:false,
                };
                vs.window.showInformationMessage(`File is locked by [${check.username}]`,opts,...['Request ownership ?'])
                .then((item)=>{
                    if ( item ) {
                       this.uiPub(check,{
                            type:UIMessageType.lockRequest,
                            from:this.tag,
                            message:`Unlock request for ${key} ?`,
                            payload:{                                
                                file:key,
                            }
                        });
                    }
                });              
            }
        }
    }

    uiPub(tag:Tag,msg:UIMessage) {
        return this.pub.publish(`${channelUI}.${tag.username}`,JSON.stringify(msg));
    }

    nsKey(key:string) {
        if ( !vs.window.activeTextEditor ) {
            const ns = vs.workspace.name;
            return `${ns}:${key}`;
        }
        const ns = this.ns;
        return `${ns}:${key}`;
    }

    async getFileTag() {
        if ( !vs.window.activeTextEditor ) {
            this.enabled = false;
            return;
        }
        const {uri} = vs.window.activeTextEditor.document;
        if ( uri.scheme !== 'file' ) {
            this.enabled = false;
            return;
        }
        const root = this.getRoot(uri!);
        if ( !root ) {
            this.enabled = false;
            return;
        } 
        const key = uri!.path.substring(root!.length);
        // console.log("F>",uri.path);
        // console.log("R>",root);
        // console.log("K>",key);
        return key;
    }

    getRoot(file?:vs.Uri) {
        const levelUp = (dir:string) => {
            if ( dir === "/" ) {
                return null;
            }
            const defIdx = this.folders.indexOf(dir);

            if ( defIdx === -1 ) {
                const dotGit = path.join(dir,".git");
                const found = existsSync(dotGit);
                if ( found ) {
                    // const p = dir.split(path.sep);
                    return dir;
                }
            } else {
                // const p = dir.split(path.sep);
                return dir;
            }
            const parts = dir.split(path.sep);            
            if ( parts.length > 1 ) {                
                parts.pop();
                const prevPath = path.join(path.sep,...parts);
                return levelUp(prevPath);
            }
            return null;
        };
        
        if ( !file && !vs.window.activeTextEditor ) {
            this.enabled = false;
            return null;
        }
        const fsPath = file?.path || vs.window.activeTextEditor?.document?.uri?.path;
        const prs = path.parse(fsPath!);
        const found = levelUp(prs.dir);
        return found;
    }

    get ns() {

        if ( !vs.window.activeTextEditor ) {
            this.enabled = false;
            return '';
        }
        const {uri} = vs.window.activeTextEditor.document;
        const found = getPathNS(uri.path,this.folders);
        if ( found ) {
            this.enabled = true;
            return found;
        } else {
            logger.warn(`No Repository found for: ${uri.path}`);
            this.enabled = false;
        }
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
        console.log("Extension stopped.");
        this.pub.disconnect(false);
        this.sub.disconnect(false);
    }
}