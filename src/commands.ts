import * as vscode from "vscode";
import { Controller } from "./ui";
import * as C from "./conts";
import { LockMessage } from "./types";
import * as path from "path";
import * as fs from "fs";

export function registerCommands(ctx:vscode.ExtensionContext)  {
    const ctrl = new Controller(ctx);
    ctx.subscriptions.push(ctrl);

    function indicatorAction () {
        ctrl.toggleLock();
    }

    function updateLock(state:C.LockState) {
        ctrl.update(state);
    }

    function updateStatusBar (state:C.LockState,msg:LockMessage) {
        ctrl.updateStatusBar(state,msg);
    }

    function wipeLocked() {
        ctrl.wipeLocked();
    }

    function ctxUnlock(msg:LockMessage) {
      ctrl.ctxUnlock(msg);
    }

    function ctxOpen(msg:LockMessage) {
      vscode.workspace.workspaceFolders?.forEach((ws)=>{
        const file = path.join(ws.uri.fsPath,msg.file);
        console.log("Try open",file);
        if ( fs.existsSync(file) ) {
          vscode.window.showTextDocument(vscode.Uri.parse(file));
          return;
        }
      });
    }


    ctx.subscriptions.push(vscode.commands.registerCommand(C.statusBarAction,indicatorAction));
    
    /*
      Reflects other side locks
    */
    ctx.subscriptions.push(vscode.commands.registerCommand(C.LockCommands.updateLock,updateStatusBar));

    /*
      Tab Context menu Lock/Unlock - user side
    */
    ctx.subscriptions.push(vscode.commands.registerCommand(C.LockCommands.lock,() => updateLock(C.LockState.Locked)));
    ctx.subscriptions.push(vscode.commands.registerCommand(C.LockCommands.unlock,() => updateLock(C.LockState.Unlocked)));
    ctx.subscriptions.push(vscode.commands.registerCommand(C.LockCommands.wipeLocked,() => wipeLocked()));
    ctx.subscriptions.push(vscode.commands.registerCommand(C.LockCommands.ctxUnlock,(args) => ctxUnlock(args)));
    ctx.subscriptions.push(vscode.commands.registerCommand(C.LockCommands.ctxOpen,(args) => ctxOpen(args)));

    return ctrl;
}


