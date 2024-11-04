import * as vscode from "vscode";
import { Controller } from "./ui";
import * as C from "./conts";
import { LockMessage } from "./types";
import * as path from "path";
import * as fs from "fs";
import {glob} from "glob";
import * as mm from "micromatch";

export function registerCommands(ctx:vscode.ExtensionContext)  {
    const ctrl = new Controller(ctx);
    ctx.subscriptions.push(ctrl);

    function toggleLock () {
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
        const [ns,fileName] = msg.file.split(":");
        const mask = path.join(ws.uri.path,'**',ns,"**",fileName); 
        glob(mask)
        .then((files)=>{
          if ( files?.length ) {
            const [file] = files;
            vscode.window.showTextDocument(vscode.Uri.parse(file));
          } else {
            vscode.window.showErrorMessage(`Cannot open document,using ${mask}`);
          }
        });
      });
    }

    function ctxLockFolder (startDir:vscode.Uri) {

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const getFiles = (ignore:string[]) => {
        return glob(path.join(startDir.path,'**/*'),{ignore,dot:true})
        .then((files)=>{
          return mm(files,"**/*.*",{ignore});
        });
      };

      const getIgnores = async () => {
          const root = vscode.workspace.getWorkspaceFolder(startDir);
          const mask = path.join(root!.uri.path,"**",".gitignore");
          return glob(mask)
          .then((files)=>{
            return files.map((gitIgnore)=>{
              const content = fs.readFileSync(gitIgnore).toString("utf8");
              return content.split("\n").map((line) => line.trim())
                     .filter(line => line.length > 0 && !line.startsWith("#"));
            });
          }).then((igns)=>{
              const uniq = new Set();
              igns.forEach((file) => file.map(f => uniq.add(  `*/**/${f}`)));
              return Array.from(uniq.keys()) as string[];
          });
      };

      getIgnores()
      .then((ignores)=>{
        console.log("IGNO",ignores);
        getFiles(ignores)
        .then((locks)=>{
          ctrl.storage.lockGroup(locks);
        });
      });
    }


    /*
      Status bar toggler
    */
    ctx.subscriptions.push(vscode.commands.registerCommand(C.statusBarAction,toggleLock));
    
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
    ctx.subscriptions.push(vscode.commands.registerCommand(C.LockCommands.lockFolder,(args) => ctxLockFolder(args)));

    /*
       Open doc from expoloer
    */
    ctx.subscriptions.push(vscode.commands.registerCommand(C.LockCommands.ctxOpen,(args) => ctxOpen(args)));


    return ctrl;
}


