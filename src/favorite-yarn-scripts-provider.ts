import * as vscode from 'vscode';
import { Script } from './yarn-scripts-per-level-provider';

export class FavoriteYarnScriptsProvider implements vscode.TreeDataProvider<FavoriteScript> {
  private _onDidChangeTreeData: vscode.EventEmitter<FavoriteScript | undefined | void> = new vscode.EventEmitter<FavoriteScript | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<FavoriteScript | undefined | void> = this._onDidChangeTreeData.event;
  public favoriteScripts: FavoriteScript[] = [];

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<FavoriteScript[]> {
    return Promise.resolve(this.favoriteScripts);
  }

  addFavoriteScript(script: Script) {
    const favoriteScriptIndex = this.favoriteScripts.findIndex(favoriteScript => favoriteScript.id === script.id);
    if (favoriteScriptIndex > -1) {
        return;
    }

    const favoriteScript = new FavoriteScript(script.id, script.label, script.description, vscode.TreeItemCollapsibleState.None, script.command);
    this.favoriteScripts.push(favoriteScript);
    this.favoriteScripts.sort((a, b) => a.label.localeCompare(b.label));
    this._onDidChangeTreeData.fire();
  }

  removeFavoriteScript(script: Script) {
    const favoriteScriptIndex = this.favoriteScripts.findIndex(favoriteScript => favoriteScript.id === script.id);
    if (favoriteScriptIndex > -1) {
      this.favoriteScripts.splice(favoriteScriptIndex, 1);
      this._onDidChangeTreeData.fire();
    }
  }
}

export class FavoriteScript extends vscode.TreeItem {
  constructor(
    public readonly id: string,
    public readonly label: string,
    public readonly description: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command: vscode.Command
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}-${this.description}`;
    this.iconPath = {
        light: 'resources/light/star-filled.svg',
        dark: 'resources/dark/star-filled.svg'
    };
  }
}

export class FavoriteScriptState {
    constructor(private workspaceState: vscode.Memento){}

    public getFavoriteScripts(): FavoriteScript[] {
        return this.workspaceState.get('favoriteScripts', []);
    }

    public addFavoriteScript(script: FavoriteScript) {
        const favoriteScripts = this.getFavoriteScripts();
        favoriteScripts.push(script);
        this.workspaceState.update('favoriteScripts', favoriteScripts);
    }
}