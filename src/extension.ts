// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { YarnScriptsPerLevelProvider } from './yarn-scripts-per-level-provider';
import { runCommand } from './run-command';
// import { FavoriteYarnScriptsProvider } from './favorite-yarn-scripts-provider';

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

  // const favoriteScriptsProvider = new FavoriteYarnScriptsProvider();

  // vscode.window.registerTreeDataProvider('yarnScriptsFavorites', favoriteScriptsProvider);

  const yarnScriptsPerLevelProvider = new YarnScriptsPerLevelProvider(rootPath, context.workspaceState);

  vscode.window.registerTreeDataProvider('yarnScriptsPerLevel', yarnScriptsPerLevelProvider);

  vscode.window.onDidChangeActiveTextEditor(() => {
    yarnScriptsPerLevelProvider.refreshIfNeeded();
  });

  vscode.commands.registerCommand('extension.runYarnScript', runCommand);
  vscode.commands.registerCommand('extension.resetCache', () => {
    yarnScriptsPerLevelProvider.resetCache();
    yarnScriptsPerLevelProvider.refreshIfNeeded();
    vscode.window.showInformationMessage('Yarn scripts cache reset');
  });

  const extensionVersion = vscode.extensions.getExtension('vscode-yarn-script-runner')?.packageJSON.version;
  const lastExtensionVersion = context.workspaceState.get('extensionVersion', extensionVersion);

  if(extensionVersion !== lastExtensionVersion) {
    context.workspaceState.update('extensionVersion', extensionVersion);
    vscode.commands.executeCommand('extension.resetCache');
  }
}

// This method is called when your extension is deactivated
export function deactivate() {}
