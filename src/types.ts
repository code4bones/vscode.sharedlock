import { LockState } from "./conts";

export interface Tag {
    username:string;
    host:string;
}

export interface LockMessage {
    state:LockState;
    file:string;
    tag:Tag;
}
