import * as vscode from 'vscode';

const terminalName = 'Yarn Scripts';

export const runCommand = (script: string, dirToRunScriptIn: string) => {
    const existingTerminal = vscode.window.terminals.find(term => term.name === terminalName);

    const terminal = existingTerminal || vscode.window.createTerminal(terminalName);

    terminal.show();
    terminal.sendText(`cd ${dirToRunScriptIn}`);
    terminal.sendText(`yarn run ${script}`);
};
