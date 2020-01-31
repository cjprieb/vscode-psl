import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as utils from '../hostCommands/hostCommandUtils';

import { TestAdapter, TestLoadStartedEvent, TestLoadFinishedEvent, TestRunStartedEvent, TestRunFinishedEvent, TestSuiteEvent, TestEvent, TestSuiteInfo } from 'vscode-test-adapter-api';
import { Log } from 'vscode-test-adapter-util';
import { PslUnitTestFinder } from './psl-unit-test-finder';
import { PslUnitTestRunner } from './psl-unit-test-runner';

export class PslTestAdapter implements TestAdapter {
    private disposables: {dispose(): void}[] = [];
    
	private readonly testsEmitter = new vscode.EventEmitter<TestLoadStartedEvent | TestLoadFinishedEvent>();
	private readonly testStatesEmitter = new vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>();
    private readonly autorunEmitter = new vscode.EventEmitter<void>();
    private pslUnitTestFinder = new PslUnitTestFinder();
    private isLoading = false;
    private runningTestProcess: child_process.ChildProcess | undefined;
    private loadedTestSuite: TestSuiteInfo;    

	get tests(): vscode.Event<TestLoadStartedEvent | TestLoadFinishedEvent> { return this.testsEmitter.event; }
	get testStates(): vscode.Event<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent> { return this.testStatesEmitter.event; }
	get autorun(): vscode.Event<void> | undefined { return this.autorunEmitter.event; }

    constructor(
        public readonly workspace: vscode.WorkspaceFolder,
        private readonly log: Log
    ) {
        this.log.info('Initializing PSL test adapter');

        this.disposables.push(this.testsEmitter);
        this.disposables.push(this.testStatesEmitter);
        this.disposables.push(this.autorunEmitter);
    }

    async load(): Promise<void> {
        if (this.isLoading) return;

        this.isLoading = true;
        this.log.info('Loading PSL tests');
        this.testsEmitter.fire(<TestLoadStartedEvent>{ type: 'started' });

        try {
            this.loadedTestSuite = await this.loadTests();
            this.testsEmitter.fire(<TestLoadFinishedEvent>{ type: 'finished', suite: this.loadedTestSuite });
        } catch (error) {
            this.testsEmitter.fire({type: 'finished', errorMessage: error.message});
        }

        this.isLoading = false;
    }

    async run(tests: string[]): Promise<void> {
        if (this.runningTestProcess !== undefined) return;

        this.log.info(`Running PSL tests ${JSON.stringify(tests)}`);
        this.testStatesEmitter.fire(<TestRunStartedEvent>{ type: 'started', tests });
        const testRunner: PslUnitTestRunner = new PslUnitTestRunner(this.loadedTestSuite, this.testStatesEmitter);
        await testRunner.runSelectedTests(tests).catch((e: Error) => {
            utils.logger.error(`${utils.icons.ERROR} Error running unit tests - ${e.message}`);
        });
        // return new Promise<void>((resolve, _) => {
            // let args: string[] = [];
            // args.push(JSON.stringify(this.loadedTestSuite));
            // args.push(JSON.stringify(tests));
            // let args = {
            //     loadedTests: this.loadedTestSuite,
            //     testsToRun: tests
            // };
            // console.log("forking the process");
            // this.runningTestProcess = child_process.fork('/adapter/psl-unit-test-runner');
            // this.runningTestProcess.on('message', function(event) {                
            //     this.testStatesEmitter.fire(event);
            // });
            // this.runningTestProcess.send(args);

            // // the child process will always send an `exit` event when it ends,
            // // even when it crashes or is killed, so we can fire the 
            // // TestRunFinishedEvent there.
            // this.runningTestProcess.once('exit', () => {
            //     this.runningTestProcess = undefined;
            //     this.testStatesEmitter.fire(<TestRunFinishedEvent>{ type: 'finished' });
            //     resolve();
            // });
        // });
    }

    /* Implement this method to support debugging tests
    async debug(tests: string[]): Promise<void> {
		// start a test run in a child process and attach the debugger to it...
    }
    */

    cancel(): void {
        // kill the child process for the current test run (if any);
        // if (this.runningTestProcess !== undefined) {
        //     this.runningTestProcess.kill();
        //     // the `exit` event will be handled by `run()` above.
        // }
    }

    dispose(): void {
        this.cancel();
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
    }

    async loadTests(): Promise<TestSuiteInfo> {
        this.log.info(`${utils.icons.REFRESH} LOADING UNIT TESTS`);
        const workspace = vscode.workspace.workspaceFolders[0];
        const testSuites = await this.pslUnitTestFinder.getUnitTestSuites(workspace);
        const rootSuite: TestSuiteInfo = {
            type: 'suite',
            id: 'root',
            label: 'PSL',
            children: testSuites
        };
        
        const totalTests = testSuites
            .map(suite => suite.children.length)
            .reduce((a, b) => a + b);
        const methodPlural = totalTests == 1 ? "test" : "tests";
        utils.logger.info(`${utils.icons.SUCCESS}    ${totalTests} ${methodPlural} found.`);

        return rootSuite;
    }
}