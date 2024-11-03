import * as vs from "vscode";
import * as C from "./conts";
import { Controller } from "./ui";
import { LockMessage } from "./types";
import * as path from 'path';


export class LocksView {
    constructor(ctx:vs.ExtensionContext,ctrl:Controller) {
        const view = vs.window.createTreeView(C.locksViewID,{
            treeDataProvider:new LockViewDataProvider(ctrl),
            showCollapseAll:false,
        });
        ctx.subscriptions.push(view);
    }
}

/*
interface LockData {
    msg:LockMessage;
    name:string;
    isDir:boolean;
}
*/
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface LockData extends LockMessage {
    
}

class LockViewDataProvider implements vs.TreeDataProvider<LockData> {
    private ctrl:Controller;

    private _onDidChangeTreeData: vs.EventEmitter<LockData | undefined> = new vs.EventEmitter<LockData | undefined>();
	readonly onDidChangeTreeData: vs.Event<LockData | undefined> = this._onDidChangeTreeData.event;    
    
    constructor(ctrl:Controller) {
        this.ctrl = ctrl;  
        this.ctrl.onDidLockChanged(()=>{
            this.refresh();
        });
    }

    public refresh() {
        this._onDidChangeTreeData.fire(undefined);
    }

    getChildren(_e:LockData): Thenable<LockData[]> {
        return this.ctrl.storage.locks;
        /*
        .then((items)=>{
            return items.map((i) => ({name:i.file.split(":")[0],isDir:true,msg:i}));
            if ( !e ) {
                return items.map((i) => ({name:i.file.split(":")[0],isDir:true,msg:i}));
            } else {
                return items.map((i) => ({name:i.file.split(":")[1],isDir:false,msg:i}));
            }
        });
        */
    }
    /*
    getParent(element: LockData): vs.ProviderResult<LockData> {
        console.log("getParent",element);
        return {key:"ROOT"};
    }
    */

    getTreeItem(element: LockData): vs.TreeItem | Thenable<vs.TreeItem> {
        const [,file] = element.file.split(":");
        const p = path.parse(file);
        const {state} = element;
        const icon = state === C.LockState.Owned ? 'pencil.png' : 'lock_1.png';
        return {
            label:`${p.name}.${p.ext}`,
            description:p.dir,
            iconPath:{
                light:path.join(__filename,"..","..","resources","icons",icon),
                dark:path.join(__filename,"..","..","resources","icons",icon),
            },
            tooltip:p.base,
            resourceUri:vs.Uri.parse(file),
            command:{
                command:C.LockCommands.ctxOpen,
                title:"Отпустить файл",
                arguments:[element],                
            },
            contextValue:state
        };
    }
}
