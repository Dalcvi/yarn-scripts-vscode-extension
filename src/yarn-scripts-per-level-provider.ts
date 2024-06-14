import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
// import { FavoriteYarnScriptsProvider } from './favorite-yarn-scripts-provider';

export class YarnScriptsPerLevelProvider implements vscode.TreeDataProvider<Script | TopLevelName> {
  private _onDidChangeTreeData: vscode.EventEmitter<Script | undefined | void> = new vscode.EventEmitter<
    Script | undefined | void
  >();
  readonly onDidChangeTreeData: vscode.Event<Script | undefined | void> = this._onDidChangeTreeData.event;
  private rootOneBehind: string;
  private yarnScriptsCache: YarnScriptsCache;
  private highestLevelPackageJsonPath: string | undefined;

  constructor(private workspaceRoot: string, private workspaceState: vscode.Memento) {
    this.rootOneBehind = path.join(workspaceRoot, '..');
    this.yarnScriptsCache = new YarnScriptsCache(workspaceState);
  }

  getTreeItem(element: Script | TopLevelName): vscode.TreeItem {
    // if (element instanceof Script) {
    //   this.updateFavoriteScriptsIfNeeded(element.id, element.checkboxState === vscode.TreeItemCheckboxState.Checked);
    // }
    return element;
  }

  getChildren(element: Script | TopLevelName): Thenable<Script[] | TopLevelName[]> {
    const openFilePath = vscode.window.activeTextEditor?.document.fileName;

    if (!openFilePath) {
      return Promise.resolve([]);
    }

    if (!element) {
      return this.getOpenFilePackageJsonNames(openFilePath);
    }

    if (element instanceof Script) {
      return Promise.resolve([]);
    }

    return this.getPackageJsonScripts(element.pathToPackageJson);
  }

  public async getOpenDirPackageJsonPath(): Promise<string | undefined> {
        const activeTextEditorFilePath = vscode.window.activeTextEditor?.document.fileName;
    const activeTabUri =
      vscode.window.tabGroups.activeTabGroup.activeTab?.input instanceof vscode.TabInputText
        ? vscode.window.tabGroups.activeTabGroup.activeTab.input.uri
        : undefined;
    const openFilePath = activeTextEditorFilePath || activeTabUri?.fsPath;

    if (!openFilePath) {
      return;
    }

    const openFileDir = path.dirname(openFilePath);

    const topLevelPackageJsonPath = await this.getTopLevelPackageJsonPath(openFileDir);

    return topLevelPackageJsonPath;
  }

  public async refreshIfNeeded(): Promise<void> {
    const topLevelPackageJsonPath = await this.getOpenDirPackageJsonPath();

    if (topLevelPackageJsonPath !== this.highestLevelPackageJsonPath) {
      this._onDidChangeTreeData.fire();
    }
  }

  public async refresh(): Promise<void> {
    this._onDidChangeTreeData.fire();
  }

  resetCache(): void {
    this.yarnScriptsCache.resetCache();
    this.highestLevelPackageJsonPath = undefined;
  }

  private async getTopLevelPackageJsonPath(folderPath: string): Promise<string | undefined> {
    if (folderPath.includes('node_modules')) {
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
    if (folderPath.includes('node_modules')) {
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

  // private isFavorite(id: string): boolean {
  //   return this.workspaceState.get<string[]>('favoriteScripts', []).includes(`${id}`);
  // }

  // private updateFavoriteScriptsIfNeeded(id: string, isFavorite: boolean): void {
  //   const favoriteScripts = this.workspaceState.get<string[]>('favoriteScripts', []);
  //   const isScriptAlreadyFavorite = favoriteScripts.includes(id);
  //   if ((isFavorite && isScriptAlreadyFavorite) || (!isFavorite && !isScriptAlreadyFavorite)) {
  //     return;
  //   }

  //   if (isFavorite) {
  //     favoriteScripts.push(id);
  //     this.workspaceState.update('favoriteScripts', favoriteScripts);
  //     return;
  //   }

  //   const index = favoriteScripts.indexOf(id);
  //   if (index > -1) {
  //     favoriteScripts.splice(index, 1);
  //   }

  //   this.workspaceState.update('favoriteScripts', favoriteScripts);
  // }

  private async getPackageJsonScripts(packageJsonPath: string): Promise<Script[]> {
    const scriptsCache = this.yarnScriptsCache.getScriptsCache();
    
    if (scriptsCache[packageJsonPath]) {
      // const updatedScriptsCache = scriptsCache[packageJsonPath].map((script) => {
      //   script.checkboxState = this.isFavorite(`${packageJsonPath}-${script.label}`)
      //     ? vscode.TreeItemCheckboxState.Checked
      //     : vscode.TreeItemCheckboxState.Unchecked;
      //   return script;
      // });

      // this.yarnScriptsCache.updateScriptsCache({ [packageJsonPath]: updatedScriptsCache });
      return scriptsCache[packageJsonPath];
    }

    if (!this.pathExists(packageJsonPath)) {
      return [];
    }

    const packageJsonCache = this.yarnScriptsCache.getPackageJsonContentsCache()['packageJsonPath'];

    const packageJson = packageJsonCache || JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    if (!packageJsonCache) {
      this.yarnScriptsCache.updatePackageJsonContentsCache({ [packageJsonPath]: packageJson });
    }

    const packageJsonDir = path.dirname(packageJsonPath);

    const scripts = packageJson.scripts
      ? [
        new Script(
            'Go to directory',
            '',
            vscode.TreeItemCollapsibleState.None,
            {
              command: 'extension.runYarnScript',
              title: 'Run Script',
              arguments: ['', packageJsonDir, packageJson.name],
            },
            packageJsonPath,
          ), ...Object.keys(packageJson.scripts)
          .sort()
          .map((script) => {
            const newScript = new Script(
              script,
              packageJson.scripts[script],
              vscode.TreeItemCollapsibleState.None,
              {
                command: 'extension.runYarnScript',
                title: 'Run Script',
                arguments: [`yarn run ${script}`, packageJsonDir, packageJson.name],
              },
              packageJsonPath,
            );
            return newScript;
          })]
      : [];

    this.yarnScriptsCache.updateScriptsCache({ [packageJsonPath]: scripts });

    return scripts;
  }

  public async getOpenFilePackageJsonNames(openFileDir: string): Promise<TopLevelName[]> {
    const packageJsonPaths = await this.getAllPackageJsons(openFileDir);

    this.highestLevelPackageJsonPath = packageJsonPaths[0];

    return packageJsonPaths
      .map((packageJsonPath, index) => {
        const packageName = this.yarnScriptsCache.getPackageNameCache()[packageJsonPath];
        if (packageName) {
          return new TopLevelName(
            packageName,
            index === 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
            packageJsonPath,
          );
        }

        const packageJson =
          this.yarnScriptsCache.getPackageJsonContentsCache()[packageJsonPath] ||
          JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

        if (packageJson) {
          this.yarnScriptsCache.updatePackageJsonContentsCache({ [packageJsonPath]: packageJson });
        }

        if (!packageJson.name) {
          return undefined;
        }
        this.yarnScriptsCache.updatePackageNameCache({ [packageJsonPath]: packageJson.name });

        return new TopLevelName(
          packageJson.name,
          index === 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
          packageJsonPath,
        );
      })
      .filter(Boolean) as TopLevelName[];
  }

  private pathExists(p: string): boolean {
    try {
      if (this.yarnScriptsCache.getDoesPathExistCache()[p]) {
        return this.yarnScriptsCache.getDoesPathExistCache()[p];
      }
      fs.accessSync(p);
    } catch (err) {
      this.yarnScriptsCache.updateDoesPathExistCache({ [p]: false });
      return false;
    }
    this.yarnScriptsCache.updateDoesPathExistCache({ [p]: true });
    return true;
  }
}

class TopLevelName extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public pathToPackageJson: string,
  ) {
    super(label, collapsibleState);
  }
}

export class Script extends vscode.TreeItem {
  public id: string;
  constructor(
    public readonly label: string,
    public readonly description: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command: vscode.Command,
    private pathToPackageJson: string,
  ) {
    super(label, collapsibleState);
    this.id = `${this.label}-${this.description}-${this.pathToPackageJson}`;
    this.tooltip = `${this.label}-${this.description}`;
  }
}

export class YarnScriptsCache {
  private scriptsCache: { [packageJsonPath: string]: Script[] };
  private packageNameCache: { [packageJsonPath: string]: string };
  private doesPathExistCache: { [path: string]: boolean };
  private packageJsonContentsCache: { [packageJsonPath: string]: string };

  constructor(private workspaceState: vscode.Memento) {
    this.scriptsCache = workspaceState.get<{ [packageJsonPath: string]: Script[] }>('scriptsCache', {}) || {};
    this.packageNameCache = workspaceState.get<{ [packageJsonPath: string]: string }>('packageNameCache', {}) || {};
    this.doesPathExistCache = workspaceState.get<{ [path: string]: boolean }>('doesPathExistCache', {}) || {};
    this.packageJsonContentsCache =
      workspaceState.get<{ [packageJsonPath: string]: string }>('packageJsonContentsCache', {}) || {};
  }

  public getScriptsCache() {
    return this.scriptsCache;
  }

  public getPackageNameCache() {
    return this.packageNameCache;
  }

  public getDoesPathExistCache() {
    return this.doesPathExistCache;
  }

  public getPackageJsonContentsCache() {
    return this.packageJsonContentsCache;
  }

  public resetCache(): void {
    this.scriptsCache = {};
    this.packageNameCache = {};
    this.doesPathExistCache = {};
    this.packageJsonContentsCache = {};

    this.workspaceState.update('scriptsCache', this.scriptsCache);
    this.workspaceState.update('packageNameCache', this.packageNameCache);
    this.workspaceState.update('doesPathExistCache', this.doesPathExistCache);
    this.workspaceState.update('packageJsonContentsCache', this.packageJsonContentsCache);
  }

  public updateScriptsCache(scriptsCache: { [packageJsonPath: string]: Script[] }) {
    this.scriptsCache = { ...this.scriptsCache, ...scriptsCache };
    this.workspaceState.update('scriptsCache', this.scriptsCache);
  }

  public updatePackageNameCache(packageNameCache: { [packageJsonPath: string]: string }) {
    this.packageNameCache = { ...this.packageNameCache, ...packageNameCache };
    this.workspaceState.update('packageNameCache', this.packageNameCache);
  }

  public updateDoesPathExistCache(doesPathExistCache: { [path: string]: boolean }) {
    this.doesPathExistCache = { ...this.doesPathExistCache, ...doesPathExistCache };
    this.workspaceState.update('doesPathExistCache', this.doesPathExistCache);
  }

  public updatePackageJsonContentsCache(packageJsonContentsCache: { [packageJsonPath: string]: string }) {
    this.packageJsonContentsCache = { ...this.packageJsonContentsCache, ...packageJsonContentsCache };
    this.workspaceState.update('packageJsonContentsCache', this.packageJsonContentsCache);
  }
}
