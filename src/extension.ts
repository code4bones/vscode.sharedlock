import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { LocksView } from './locksView';
import { createLogger } from './logger';

export function activate(context: vscode.ExtensionContext) {
	createLogger(context).appendLine("Starting...");
	const ctrl = registerCommands(context);
	new LocksView(context,ctrl);
	ctrl.initialUpdate();
}
