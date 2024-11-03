
const name = "sharedlock";
const statusBarID = `${name}.statusBar`;
const statusBarAction = `${name}.indicatorAction`;
const locksViewID = `${name}.locksView`;

export enum LockCommands {
    updateLock = `${name}.updateLock`,
    toggleLock = `${name}.toggleLock`,
    lock = `${name}.lock`,
    unlock = `${name}.unlock`,
    wipeLocked = `${name}.wipeLocked`,
    ctxUnlock = `${name}.ctxUnlock`,
    ctxOpen = `${name}.ctxOpen`
}

export enum LockState {
    Owned = "owned",
    Locked = "locked",
    Unlocked = "unlocked",
}

export {
    name,
    statusBarID,
    statusBarAction,
    locksViewID
};