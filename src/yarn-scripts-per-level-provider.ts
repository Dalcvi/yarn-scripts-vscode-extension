import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class YarnScriptsPerLevelProvider implements vscode.TreeDataProvider<Script | TopLevelName> {
  private _onDidChangeTreeData: vscode.EventEmitter<Script | undefined | void> = new vscode.EventEmitter<Script | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<Script | undefined | void> = this._onDidChangeTreeData.event;
  private rootOneBehind: string;
  private scriptsCache: { [packageJsonPath: string]: Script[] } = {};
  private packageNameCache: { [packageJsonPath: string]: string } = {};

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
      return this.getOpenFilePackageJsonNames(openFilePath);
    }

    if(element instanceof Script) {
      return Promise.resolve([]);
    }

    const openFileDir = path.dirname(openFilePath);

    return this.getPackageJsonScripts(element.pathToPackageJson, openFileDir);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  resetCache(): void {
    this.scriptsCache = {};
  }


  private async getAllPackageJsons(folderPath: string): Promise<string[]> {
    if(folderPath.includes('node_modules')) {
      return this.getAllPackageJsons(folderPath.split('node_modules')[0]);
    }

    const parent = path.join(folderPath, '..');

    if (this.pathExists(path.join(folderPath, 'package.json'))) {
      return [path.join(folderPath, 'package.json'), ...(await this.getAllPackageJsons(parent))];
    }
    
    if (parent === folderPath || parent === this.rootOneBehind) {
      return [];
    }

    return [...(await this.getAllPackageJsons(parent))];
  }

  private async getPackageJsonScripts(packageJsonPath: string, openFileDir: string): Promise<Script[]> {
    if(this.scriptsCache[packageJsonPath]) {
      return this.scriptsCache[packageJsonPath];
    }
    if (!this.pathExists(packageJsonPath)) {
      return [];
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    const scripts = packageJson.scripts
      ? Object.keys(packageJson.scripts).sort().map(
        script => new Script(script, packageJson.scripts[script], vscode.TreeItemCollapsibleState.None, {
          command: 'extension.runYarnScript',
          title: 'Run Script',
          arguments: [script, openFileDir]
        })
      )
      : [];

    this.scriptsCache[packageJsonPath] = scripts;

    return scripts;
  }

  private async getOpenFilePackageJsonNames(openFileDir: string): Promise<TopLevelName[]> {
    const packageJsonPaths = await this.getAllPackageJsons(openFileDir);
    return packageJsonPaths.map((packageJsonPath, index) => {
      if(this.packageNameCache[packageJsonPath]) {
        return new TopLevelName(this.packageNameCache[packageJsonPath], index === 0 ? vscode.TreeItemCollapsibleState.Expanded :vscode.TreeItemCollapsibleState.Collapsed , packageJsonPath);
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      if (!packageJson.name) {
        return undefined;
      }

      this.packageNameCache[packageJsonPath] = packageJson.name;

    return new TopLevelName(packageJson.name, index === 0 ? vscode.TreeItemCollapsibleState.Expanded :vscode.TreeItemCollapsibleState.Collapsed , packageJsonPath);
    }).filter(Boolean) as TopLevelName[];
  
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
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public pathToPackageJson: string
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
