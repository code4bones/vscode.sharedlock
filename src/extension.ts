import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { LocksView } from './locksView';
import { createLogger } from './logger';

export function activate(context: vscode.ExtensionContext) {

	const folders:string[] = [];
	vscode.workspace.workspaceFolders?.forEach((ws)=>{
		folders.push(ws.uri.path);
	});
	context.globalState.update("roots",JSON.stringify(folders));
	createLogger(context).appendLine("Starting...");
	const ctrl = registerCommands(context);
	new LocksView(context,ctrl);
	ctrl.initialUpdate();
}
