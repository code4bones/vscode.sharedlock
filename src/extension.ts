import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { LocksView } from './locksView';
import { createLogger } from './logger';
import { loadConfig, saveConfig } from './utils/getConfig';
import { LockCommands } from './conts';

export function activate(context: vscode.ExtensionContext) {

	const folders:string[] = [];
	vscode.workspace.workspaceFolders?.forEach((ws)=>{
		folders.push(ws.uri.path);
	});
	context.globalState.update("roots",JSON.stringify(folders));
	createLogger(context).appendLine("Starting...");
	const ctrl = registerCommands(context);
	new LocksView(context,ctrl);
	const cfg = loadConfig();
	if ( cfg.common.welcome ) {
		cfg.common.welcome = false;
		saveConfig(cfg);
		vscode.commands.executeCommand(LockCommands.settings);
	} else {
		if ( cfg.common.autoconnect ) {
			console.log("Autoconnect...")
			vscode.commands.executeCommand(LockCommands.connect);
		} 
   }
}
