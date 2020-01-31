import * as vscode from 'vscode';

import { TestHub, testExplorerExtensionId } from 'vscode-test-adapter-api';
import { Log, TestAdapterRegistrar } from 'vscode-test-adapter-util';

import { PslTestAdapter } from './adapter';

export async function activate(context: vscode.ExtensionContext) {
	const workspaceFolder = (vscode.workspace.workspaceFolders || [])[0];

	const log = new Log('pslTestExplorer', workspaceFolder, 'PSL Test Explorer log');
	context.subscriptions.push(log);

	const testExplorerExtension = vscode.extensions.getExtension<TestHub>(testExplorerExtensionId);
	if (log.enabled) {
		log.info(`Test Explorer ${testExplorerExtensionId} ? '' : 'not ' }found`);
	}

	if (testExplorerExtension) {
		const testHub = testExplorerExtension.exports;
		// this will register a test adapter for each workspace folder
		context.subscriptions.push(new TestAdapterRegistrar(
			testHub,
			workspaceFolder => new PslTestAdapter(workspaceFolder, log),
			log
		));
	}
}