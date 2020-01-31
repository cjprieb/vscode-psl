import * as vscode from 'vscode'
import * as fs from 'fs-extra';
import * as path from 'path';

import { TestSuiteInfo, TestInfo } from 'vscode-test-adapter-api';
import { ParsedDocument, parseFile, Method } from '../parser/parser';

export class PslUnitTestFinder {

    // TODO: Can procedures be located in other directories?
    private readonly procedureSubDirectory: string = 'dataqwik/procedure/';

    constructor() {   }

    async createTestSuite(fsPath: string): Promise<TestSuiteInfo> {        
        const fileName = this.getFileNameWithoutExtension(fsPath);
        let suite: TestSuiteInfo = {
            type: 'suite',
            id: fileName,
            label: fileName,
            children: []
        };

        const parsedDocument: ParsedDocument = await parseFile(fsPath);
        const promisedTestMethods = parsedDocument.methods
            .filter(method => this.isTestMethod(method))
            .map(method => this.createTestInfo(fsPath, fileName, method));

        suite.children = await Promise.all(promisedTestMethods)
        return suite;
    }

    createTestInfo(fsPath: string, fileName: string, method: Method): TestInfo {  
        const methodName = method.id.value;
        return {
            type: 'test',
            id: methodName+"^"+fileName,
            label: methodName,
            file: fsPath,
            line: method.line
        };
    }

    getFileNameWithoutExtension(fsPath: string): string {
        const basename = path.basename(fsPath);
        const lastPeriod = basename.lastIndexOf('.');
        if (lastPeriod > 0) {
            return basename.substr(0, lastPeriod); 
        }
        else {
            return basename;
        }
    }

    async getUnitTestSuites(workspace: vscode.WorkspaceFolder): Promise<TestSuiteInfo[]> {
        const unitTestDirectory = path.join(workspace.uri.fsPath, this.procedureSubDirectory);
        const names = await fs.readdir(unitTestDirectory);
        const promisedTestSuites = names
            .filter(fileName => this.isTestProcedure(fileName))
            .map(fileName => path.join(unitTestDirectory, fileName))
            .map(filePath => this.createTestSuite(filePath));
        const testSuites = await Promise.all(promisedTestSuites);

        return testSuites.filter(suite => suite.children.length > 0);
    }

    isTestMethod(method: Method): boolean {
        return method.id.value.startsWith("test");
    }

    isTestProcedure(fileName: string): boolean {
        // ZTestRPC.PROC is the RPC that runs the unit tests;
        // it will not contain any unit tests.        
        if (fileName === "ZTestRPC.PROC") return false; 

        // Otherwise, we assume it's a unit test suite if it starts 
        // with ZTest.
        return fileName.startsWith("ZTest") && fileName.endsWith(".PROC");
    }

}