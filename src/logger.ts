import {ExtensionContext,window, LogOutputChannel} from "vscode";

let logger: LogOutputChannel;

function createLogger(ctx:ExtensionContext) {
    logger = window.createOutputChannel("SharedLock",{log:true});
    ctx.subscriptions.push(logger);
    return logger;
}

export {
    createLogger,
    logger
};

