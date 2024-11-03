import * as vscode from "vscode";
import { Controller } from "./ui";
import * as C from "./conts";
import { LockMessage } from "./types";
import * as path from "path";
import * as fs from "fs";
import {glob} from "glob";

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
        const [,fileName] = msg.file.split(":");
        const file = path.join(ws.uri.fsPath,fileName);
        console.log("Try open",file);
        if ( fs.existsSync(file) ) {
          vscode.window.showTextDocument(vscode.Uri.parse(file));
          return;
        }
      });
    }

    function ctxLockFolder (startDir:vscode.Uri) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const lockTree = (uri:vscode.Uri,ign?:string[]) => {
        vscode.workspace.fs.readDirectory(uri)
        .then((dirs)=>{
            dirs.forEach(([file,type])=>{
              const lock = vscode.Uri.parse(path.join(uri.path,file));
              if ( type === vscode.FileType.Directory ) {
                  if ( ign ) { 
                    lockTree(lock,ign);
                  }
              } else {
                console.log("Loking",lock.path);
              }
            });
        });
      };

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const getFiles = (ignore:string[]) => {
        glob(path.join(startDir.path,'**/*'),{ignore,dot:true})
        .then((files)=>{
          console.log("Files",files);
        });
      };


      const root = vscode.workspace.getWorkspaceFolder(startDir);
      const gitIgnore = path.join(root!.uri.path,".gitignore");
      if ( fs.existsSync(gitIgnore) ) {
        const content = fs.readFileSync(gitIgnore).toString("utf8");
        const ignores = content.split("\n").map((line) => line.trim()).filter(line => line.length > 0 && !line.startsWith("#"));
        console.log("IGN",ignores.map((f) => path.join("**",f)));
        // getFiles(ignores);
        // lockTree(startDir,ignores);
      } else {
          vscode.window.showInformationMessage("Where are no .gitignore file, only upper level will be processed...");
          // lockTree(startDir);
      }
      // console.log("FILE",gitIgnore);
      // lockTree(startDir);
      // vscode.Uri.parse(path.join(uri.path,file)
      //lockTree(startDir);
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
    ctx.subscriptions.push(vscode.commands.registerCommand(C.LockCommands.lockFolder,(args) => ctxLockFolder(args)));


    return ctrl;
}


