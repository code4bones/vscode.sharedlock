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

interface LockData extends LockMessage {
    key:string;
}

class LockViewDataProvider implements vs.TreeDataProvider<LockMessage> {
    private ctrl:Controller;

    private _onDidChangeTreeData: vs.EventEmitter<LockMessage | undefined> = new vs.EventEmitter<LockMessage | undefined>();
	readonly onDidChangeTreeData: vs.Event<LockMessage | undefined> = this._onDidChangeTreeData.event;    
    
    constructor(ctrl:Controller) {
        this.ctrl = ctrl;  
        this.ctrl.onDidLockChanged(()=>{
            this.refresh();
        });
    }

    public refresh() {
        this._onDidChangeTreeData.fire(undefined);
    }

    getChildren(): LockData[] | Thenable<LockMessage[]> {
        return this.ctrl.storage.locks;        
    }
    /*
    getParent(element: LockData): vs.ProviderResult<LockData> {
        console.log("getParent",element);
        return {key:"ROOT"};
    }
    */

    getTreeItem(element: LockMessage): vs.TreeItem | Thenable<vs.TreeItem> {
        console.log(element);
        const p = path.parse(element.file);
        const {state} = element;
        const icon = state === C.LockState.Owned ? 'pencil.png' : 'lock_1.png';
        return {
            label:p.name,
            description:p.dir,
            iconPath:{
                light:path.join(__filename,"..","..","resources","icons",icon),
                dark:path.join(__filename,"..","..","resources","icons",icon),
            },
            tooltip:p.base,
            resourceUri:vs.Uri.parse(element.file),
            command:{
                command:C.LockCommands.ctxOpen,
                title:"Отпустить файл",
                arguments:[element],                
            },
            contextValue:state
        };
    }
}
