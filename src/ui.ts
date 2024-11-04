import {ExtensionContext, StatusBarAlignment,StatusBarItem,window, ThemeColor } from "vscode";
import { codicons } from "vscode-ext-codicons";
import { Storage } from "./storage";

import * as C from "./conts";
import { LockMessage } from "./types";

export class StatusBar {
    private item:StatusBarItem;
    private ctx: ExtensionContext;

    constructor(ctx:ExtensionContext) {
        this.ctx = ctx;
        this.item = window.createStatusBarItem(C.statusBarID,StatusBarAlignment.Right);
        this.item.name = "Access";
        this.item.command = C.statusBarAction;
    }

    dispose() {
        this.item.dispose();
    }

    update(st:C.LockState,msg?:LockMessage) {
        if ( !window.activeTextEditor  ) {
            this.item.hide();
            return;
        }
        switch ( st ) {
            case C.LockState.Locked:
                this.item.text = codicons.lock + ` [${msg?.tag.username}]`;
                this.item.backgroundColor = new ThemeColor('statusBarItem.errorBackground');
                break;
            case C.LockState.Owned:
                this.item.text = codicons.pencil + ' [owned]';
                this.item.backgroundColor = new ThemeColor('statusBarItem.warningBackground');
                break;
            case C.LockState.Unlocked:
                this.item.text = codicons.unlock + ' [Avl.]';
                this.item.backgroundColor = new ThemeColor('statusBarItem.remoteBackground');
                break;
                    
        } 
        this.item.show();
    }
    enable(en:boolean) {
        if (en) {
            this.item.show();
        } else {
            this.item.hide();
        }
    }
}

export class Controller {
    private statusBar:StatusBar;
    private _storage:Storage;

    
    constructor(ctx:ExtensionContext) {
        this._storage = new Storage(ctx);
        this.statusBar = new StatusBar(ctx);
        this.statusBar.update(C.LockState.Unlocked);
        ctx.subscriptions.push(this.statusBar,this.storage);
        this._storage.onDidEnabledChanged((enable)=>{
            this.statusBar.enable(enable);
        });
    }

    get storage () {
        return this._storage;
    }

    get onDidLockChanged () {
        return this._storage._onDidLockChanged.event;
    }

    update(state:C.LockState) {
        this._storage.setFileLockState(state);
    }

    updateStatusBar(state:C.LockState,msg:LockMessage) {
        this.statusBar.update(state,msg);

    }

    toggleLock() {
        this._storage.toggleLock();
    }

    wipeLocked() {
        this._storage.wipeLocked();
    }

    ctxUnlock(msg:LockMessage) {
        this._storage.ctxUnlock(msg);
    }

    async initialUpdate() {
        const locks = await this.storage.locks;
        if ( !locks.length ) {
            return;
        }
        this._storage.setTabStatus();        
    }

    public dispose() {
        this.statusBar.dispose();
    }


}