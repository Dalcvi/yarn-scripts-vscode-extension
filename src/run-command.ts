import * as vscode from 'vscode';

export const runCommand = (script: string, dirToRunScriptIn: string, packageJsonName: string) => {
    const terminalName = `${packageJsonName} - ${script}`;
    const existingTerminal = vscode.window.terminals.find(term => term.name === terminalName);
    const terminal = existingTerminal || vscode.window.createTerminal(terminalName);

    terminal.show();

    if(script === '') {
        terminal.sendText(`cd ${dirToRunScriptIn}`);
        return;
    }

    terminal.sendText(`cd ${dirToRunScriptIn} && ${script}`);
};
