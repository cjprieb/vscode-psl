import * as vscode from 'vscode';

import * as environment from '../common/environment';
import * as utils from '../hostCommands/hostCommandUtils';

import { TestSuiteInfo, TestInfo, TestRunStartedEvent, TestRunFinishedEvent, TestSuiteEvent, TestEvent } from 'vscode-test-adapter-api';

// process.on('message', function(data) {    
//     console.log("got message: " + data);
//     const testRunner: PslUnitTestRunner = new PslUnitTestRunner(data.loadedTests);
//     testRunner.runSelectedTests(data.testsToRun).catch((e: Error) => {
//         utils.logger.error(`${utils.icons.ERROR} Error running unit tests - ${e.message}`);
//     });
// });

// console.log("running child");

export class PslUnitTestRunner {
    private readonly unitTestRpc: string = "^ZTestRPC";

    private loadedTestSuite: TestSuiteInfo;
	private readonly testStatesEmitter = new vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>();

    constructor(loadedTestSuite: TestSuiteInfo,
        testStatesEmitter: vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>) {
        this.loadedTestSuite = loadedTestSuite;
        this.testStatesEmitter = testStatesEmitter;
    }

    // async runTests(
    //     tests: string[],
    //     testStatesEmitter: vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>
    // ): Promise<void> {    
    //     await utils.executeWithProgress(`${utils.icons.RUN} RUN UNIT TESTS`, async () => {        
    //         for (const suiteOrTestId of tests) {
    //             const node = findNode(loadedTestSuite, suiteOrTestId);
    //             if (node) {
    //                 await runNode(node, testStatesEmitter);
    //             }
    //         }
    //     }).catch((e: Error) => {
    //         utils.logger.error(`${utils.icons.ERROR} Error running unit tests - ${e.message}`);
    //     });
    // }

    findNode(searchNode: TestSuiteInfo | TestInfo, id: string): TestSuiteInfo | TestInfo | undefined {
        if (searchNode.id === id) {
            return searchNode;
        }
        else if (searchNode.type === 'suite') {
            for (const child of searchNode.children) {
                const found = this.findNode(child, id);
                if (found) return found;
            }
        }
        return undefined;
    }

    fire(data: TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent): void {
        this.testStatesEmitter.fire(data);
    }

    // async runNode(
    //     node: TestSuiteInfo | TestInfo,
    //     testStatesEmitter: vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>
    // ): Promise<void> {
    //     if (node.type === 'suite') {
    //         utils.logger.info(`${utils.icons.WAIT} ${utils.icons.RUN} RUNNING SUITE ${node.label}`);
    //         testStatesEmitter.fire(<TestSuiteEvent>{ type: 'suite', suite: node.id, state: 'running' });

    //         for (const child of node.children) {
    //             await runNode(child, testStatesEmitter);
    //         }
            
    //         testStatesEmitter.fire(<TestSuiteEvent>{ type: 'suite', suite: node.id, state: 'completed' });
    //     }
    //     else { // node.type === 'test'        
    //         testStatesEmitter.fire(<TestEvent>{ type: 'test', test: node.id, state: 'running' });
    //         await runUnitTest(node, testStatesEmitter);
    //     }
    // }

    async runSelectedTests(tests: string[]): Promise<void> {
        for (const suiteOrTestId of tests) {
            const node = this.findNode(this.loadedTestSuite, suiteOrTestId);
            if (node) {
                await this.runTestNode(node);
            }
        }
    }

    async runTestNode(node: TestSuiteInfo | TestInfo): Promise<void> {
        if (node.type === 'suite') {
            utils.logger.info(`${utils.icons.WAIT} ${utils.icons.RUN} RUNNING SUITE ${node.label}`);
            this.fire(<TestSuiteEvent>{ type: 'suite', suite: node.id, state: 'running' });

            for (const child of node.children) {
                await this.runTestNode(child);
            }
            
            this.fire(<TestSuiteEvent>{ type: 'suite', suite: node.id, state: 'completed' });
        }
        else { // node.type === 'test'        
            this.fire(<TestEvent>{ type: 'test', test: node.id, state: 'running' });
            await this.runSingleUnitTest(node);
        }
    }

    async runSingleUnitTest(node: TestInfo): Promise<void> {
        const fsPath = node.file;
        const methodToRun = node.id;
        const doc = await vscode.workspace.openTextDocument(fsPath);
        await doc.save();

        let environment = await this.getEnvironment(fsPath);
        if (environment === undefined) {            
            this.fire({ type: 'test', test: node.id, state: "errored", message: "No environment selected" });
            return;
        }

        const connection = await utils.getConnection(environment);
        const output = await connection.runCustom(fsPath, this.unitTestRpc, methodToRun);
        utils.logger.info(output.trim());
        connection.close();

        this.fire(this.createTestResults(node, output)); 
    }

    async getEnvironment(fsPath: string): Promise<environment.EnvironmentConfig | undefined> {
        let envs: environment.EnvironmentConfig[];
        try {
            envs = await utils.getEnvironment(fsPath);
        }
        catch (e) {
            return;
        }
        if (envs.length === 0) {
            return;
        }
        return envs[0];
    }

    createTestResults(
        node: TestInfo,
        output: string
    ): TestEvent {
        const obj = JSON.parse(output);
        let result: TestEvent = { type: 'test', test: node.id, state: obj.state };
        
        let message = "Passed";
        if ( obj.state !== "passed" ) {
            message = "Source:  " + obj.location + "\n" + "Message: " + obj.message;
            if (node.line && obj.line) {
                result.decorations = [{
                    message: obj.message,
                    line: node.line + obj.line
                }];
            }
        }
        result.message = message;
        return result;
    }
}