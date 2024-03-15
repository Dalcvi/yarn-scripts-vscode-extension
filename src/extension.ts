// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { YarnScriptsPerLevelProvider } from './yarn-scripts-per-level-provider';
import { runCommand } from './run-command';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const rootPath =
		vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
			? vscode.workspace.workspaceFolders[0].uri.fsPath
			: undefined;
	if (!rootPath) {
		vscode.window.showErrorMessage('No rootPath found');
		return;
	}

	const treeDataProvider = new YarnScriptsPerLevelProvider(rootPath);
	vscode.window.registerTreeDataProvider('yarnScriptsPerLevel', treeDataProvider);

	vscode.window.onDidChangeActiveTextEditor(() => {
		treeDataProvider.refresh();
	});

	vscode.commands.registerCommand('extension.runYarnScript', runCommand);
}


// This method is called when your extension is deactivated
export function deactivate() { }
