import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { ElevateCore } from '../core/ElevateCore';
import { ElevateContext } from '../core/ElevateContext';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	const core = new ElevateCore();

	let ctx = new ElevateContext("test context");

	vscode.window.showInformationMessage('Start all tests.');

	test('Pipeline logger test', () => {
		core.executePipeline(ctx);
	});
});

