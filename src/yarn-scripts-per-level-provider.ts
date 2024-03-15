import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class YarnScriptsPerLevelProvider implements vscode.TreeDataProvider<Script | TopLevelName> {
  private _onDidChangeTreeData: vscode.EventEmitter<Script | undefined | void> = new vscode.EventEmitter<Script | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<Script | undefined | void> = this._onDidChangeTreeData.event;
  private rootOneBehind: string;

  constructor(private workspaceRoot: string) {
    this.rootOneBehind = path.join(workspaceRoot, '..');
   }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element: Script | TopLevelName): Thenable<Script[] | TopLevelName[]> {
    const openFilePath = vscode.window.activeTextEditor?.document.fileName;

    if (!openFilePath) {
      return Promise.resolve([]);
    }

    if(!element) {
      return this.getOpenFilePackageJsonName(openFilePath);
    }

    const openFileDir = path.dirname(openFilePath);

    return this.getOpenFileScripts(openFileDir);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }


  private async getClosestPackageJson(folderPath: string): Promise<string | undefined> {
    if(folderPath.includes('node_modules')) {
      return this.getClosestPackageJson(folderPath.split('node_modules')[0]);
    }

    if (this.pathExists(path.join(folderPath, 'package.json'))) {
      return path.join(folderPath, 'package.json');
    }
    
    const parent = path.join(folderPath, '..');
    if (parent === folderPath || parent === this.rootOneBehind) {
      return undefined;
    }

    return this.getClosestPackageJson(parent);
  }

  private async getPackageJsonScripts(packageJsonPath: string, openFileDir: string): Promise<Script[]> {
    if (!this.pathExists(packageJsonPath)) {
      return [];
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    const scripts = packageJson.scripts
      ? Object.keys(packageJson.scripts).map(
        script => new Script(script, packageJson.scripts[script], vscode.TreeItemCollapsibleState.None, {
          command: 'extension.runYarnScript',
          title: 'Run Script',
          arguments: [script, openFileDir]
        })
      )
      : [];

    return scripts;
  }

  private async getOpenFileScripts(openFileDir: string): Promise<Script[]> {
    const packageJsonPath = await this.getClosestPackageJson(openFileDir);

    if (!packageJsonPath) {
      return [];
    }

    return this.getPackageJsonScripts(packageJsonPath, openFileDir);
  }

  private async getOpenFilePackageJsonName(openFileDir: string): Promise<TopLevelName[]> {
    const packageJsonPath = await this.getClosestPackageJson(openFileDir);

    if (!packageJsonPath) {
      return [];
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    if (!packageJson.name) {
      return [];
    }

    return [new TopLevelName(packageJson.name, vscode.TreeItemCollapsibleState.Expanded)];
  }


  private pathExists(p: string): boolean {
    try {
      fs.accessSync(p);
    } catch (err) {
      return false;
    }
    return true;
  }
}

class TopLevelName extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
  }
}

class Script extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    private version: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command: vscode.Command
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}-${this.version}`;
    this.description = this.version;
  }
}
