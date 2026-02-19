import * as vscode from 'vscode';
import { Logger } from '../Logger';
import { ExtensionController } from '../extension/ExtensionController';


export class ElevateCore {
    // Members
    //DebugLogger: Logger;
    ExtensionController: ExtensionController;

    constructor() {
        //this.DebugLogger = logger;
        this.ExtensionController = new ExtensionController();
    }

}

