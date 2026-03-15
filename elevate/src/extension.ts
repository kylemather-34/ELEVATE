// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import { Logger } from './Logger';
import { ElevateCore } from './core/ElevateCore';
import { ElevateContext } from './core/ElevateContext';

// module-level logger instance so it can be reused and disposed
let logger: Logger | undefined;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const debugActivate = vscode.commands.registerCommand('elevate.debug', () => {
		if (!logger) {
			logger = new Logger('ELEVATE', true); // enable debug
			// ensure the logger is disposed when the extension is deactivated
			context.subscriptions.push(logger);
		}
		logger.info('Activated debug mode');
		logger.show();
	});
	context.subscriptions.push(debugActivate);

	const testCommand = vscode.commands.registerCommand('elevate.runtests', () => {
		const core = new ElevateCore();
		
		let ctx = new ElevateContext("test context");
		
		vscode.window.showInformationMessage('Start all tests.');

		// Pipeline test
		core.executePipeline(ctx);
		
	});
	
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('elevate.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from ELEVATE!');
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {

}
