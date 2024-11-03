import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { LocksView } from './locksView';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "helloworld-sample" is now active!');

	const rootPath = (vscode.workspace.workspaceFolders && (vscode.workspace.workspaceFolders.length > 0))
	? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;

	context.globalState.update('rootPath',rootPath);
	console.log("ROOT PATH",rootPath);	
	

	const ctrl = registerCommands(context);
	new LocksView(context,ctrl);


	// vscode.window.showInformationMessage('Hello World,Hello !!');
}
