import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class YarnScriptsPerLevelProvider implements vscode.TreeDataProvider<Script | TopLevelName> {
  private _onDidChangeTreeData: vscode.EventEmitter<Script | undefined | void> = new vscode.EventEmitter<Script | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<Script | undefined | void> = this._onDidChangeTreeData.event;
  private rootOneBehind: string;
  private scriptsCache: { [packageJsonPath: string]: Script[] } = {};
  private packageNameCache: { [packageJsonPath: string]: string } = {};
  private doesPathExistCache: { [path: string]: boolean } = {};
  private packageJsonContentsCache: { [packageJsonPath: string]: string } = {};
  private highestLevelPackageJsonPath: string | undefined;

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

  public async refreshIfNeeded(): Promise<void> {
    const activeTextEditorFilePath = vscode.window.activeTextEditor?.document.fileName;
    const activeTabUri = vscode.window.tabGroups.activeTabGroup.activeTab?.input instanceof vscode.TabInputText ? vscode.window.tabGroups.activeTabGroup.activeTab.input.uri : undefined;
    const openFilePath = activeTextEditorFilePath || activeTabUri?.fsPath;
    
    if(!openFilePath) {
      return;
    }

    const openFileDir = path.dirname(openFilePath);

    const topLevelPackageJsonPath = await this.getTopLevelPackageJsonPath(openFileDir);

    if(topLevelPackageJsonPath !== this.highestLevelPackageJsonPath) {
      this._onDidChangeTreeData.fire();
    }
  }

  resetCache(): void {
    this.scriptsCache = {};
    this.packageNameCache = {};
    this.doesPathExistCache = {};
    this.packageJsonContentsCache = {};
    this.highestLevelPackageJsonPath = undefined;
  }

  private async getTopLevelPackageJsonPath(folderPath: string): Promise<string | undefined> {
    if(folderPath.includes('node_modules')) {
      return this.getTopLevelPackageJsonPath(folderPath.split('node_modules')[0]);
    }

    const parent = path.join(folderPath, '..');

    const packageJsonPath = path.join(folderPath, 'package.json');

    if (this.pathExists(packageJsonPath)) {
      return path.join(folderPath, 'package.json');
    }
    
    if (parent === folderPath || parent === this.rootOneBehind) {
      return undefined;
    }

    return this.getTopLevelPackageJsonPath(parent);
  }

  private async getAllPackageJsons(folderPath: string): Promise<string[]> {
    if(folderPath.includes('node_modules')) {
      return this.getAllPackageJsons(folderPath.split('node_modules')[0]);
    }

    const parent = path.join(folderPath, '..');

    const packageJsonPath = path.join(folderPath, 'package.json');

    if (this.pathExists(packageJsonPath)) {
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

    const packageJson =  this.packageJsonContentsCache[packageJsonPath] || JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    if(packageJson) {
      this.packageJsonContentsCache[packageJsonPath] = packageJson;
    }

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

    this.highestLevelPackageJsonPath = packageJsonPaths[0];

    return packageJsonPaths.map((packageJsonPath, index) => {
      if(this.packageNameCache[packageJsonPath]) {
        return new TopLevelName(this.packageNameCache[packageJsonPath], index === 0 ? vscode.TreeItemCollapsibleState.Expanded :vscode.TreeItemCollapsibleState.Collapsed , packageJsonPath);
      }

      const packageJson = this.packageJsonContentsCache[packageJsonPath] || JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      if(packageJson) {
        this.packageJsonContentsCache[packageJsonPath] = packageJson;
      }

      if (!packageJson.name) {
        return undefined;
      }

      this.packageNameCache[packageJsonPath] = packageJson.name;

    return new TopLevelName(packageJson.name, index === 0 ? vscode.TreeItemCollapsibleState.Expanded :vscode.TreeItemCollapsibleState.Collapsed , packageJsonPath);
    }).filter(Boolean) as TopLevelName[];
  
  }


  private pathExists(p: string): boolean {
    try {
      if(this.doesPathExistCache[p]) {
        return this.doesPathExistCache[p];
      }
      fs.accessSync(p);
    } catch (err) {
      this.doesPathExistCache[p] = false;
      return false;
    }
    this.doesPathExistCache[p] = true;
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
