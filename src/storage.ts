import Redis from "ioredis";
import { commands } from "vscode";
import * as vs from "vscode";
import * as os from  'os';
// import * as fs from 'fs';
import { LockCommands, LockState } from "./conts";
import { Tag,LockMessage } from "./types";
import { GitExtension } from "./git";
// import * as path from 'path';

export class Storage {
    private sub:Redis;
    private pub:Redis;
    private tag:Tag;
    private items:LockMessage[];

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

    constructor(/*ctx:ExtensionContext*/) {        
        
        this._onDidLockChanged = new vs.EventEmitter<LockMessage[]>();
        this.items = [];
        this.tag = this.getTag();
        this.sub = new Redis();
        this.pub = new Redis();
        this.sub.on("connect",()=>{
            console.log("*** CONNECTED ****");
        });
        const channel = "ch1";
        this.sub.subscribe(channel,(err,count) => {
            if ( err ){
                console.error("Cannot subscribe !",err);
            } else { 
                console.log("Subscribed",count);
            }
        });
        this.sub.on("message",(channel,msg)=>{
            this.onMessage(JSON.parse(msg));
            console.log(`${channel} ==> `,msg);
        });
        /*
        vs.window.tabGroups.onDidChangeTabs((e)=>{
            this.onChangeTabs(e);
        });
        */
        vs.window.onDidChangeActiveTextEditor((e)=>{
            console.log(">>>>> WOW",e?.document.fileName);
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

    async onChangeTabs(e:vs.TabChangeEvent) {
            const {opened,closed,changed} = e;
            opened.forEach((tab)=>{
                console.log("OPEN",tab.label);
                // this.tryLock(tab);
            });
            changed.forEach((tab)=>{
                console.log("Changed",tab.label);
                this.setTabStatus();
                // commands.executeCommand(LockCommands.updateLock,tab.label);
                // this.tryLock(tab);
            });            
            closed.forEach((tab)=>{
                console.log("Close",tab.label);
                // this.tryUnlock(tab);
            });
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
        return this.pub.del(key);
    }

    exists(key:string) {
        return this.pub.exists(key);
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
            this.pub.del(key);
        }
        this.pub.publish("ch1",JSON.stringify({state,file:key,tag:this.tag}));
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
        const ws = vs.workspace.getWorkspaceFolder(uri);
        const wsPath = ws?.uri.fsPath;
        
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
        const key = uri.fsPath.substring(wsPath!.length);
        return key;
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

    async getGIT() {
        const gitExtension = vs.extensions?.getExtension<GitExtension>('vscode.git')?.exports;
        const git = gitExtension?.getAPI(1);
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

    public dispose() {
        console.log("Killing connection");
        this.pub.disconnect(false);
        this.sub.disconnect(false);
    }
}