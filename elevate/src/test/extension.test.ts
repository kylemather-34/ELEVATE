import * as assert from 'assert';
import * as vscode from 'vscode';
import { ElevateContext } from '../backend/ElevateContext';
import { Pipeline } from '../pipeline/Pipeline';
import { SanitizationStage, PromptBuilderStage } from '../pipeline/Stage';
import { Logger } from '../Logger';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Pipeline runs without throwing on empty stages', async () => {
		const ctx = new ElevateContext("test context");
		const logger = new Logger();
		const pipeline = new Pipeline(
			[new SanitizationStage(), new PromptBuilderStage()],
			logger
		);
		await assert.doesNotReject(() => pipeline.execute(ctx));
	});
});

