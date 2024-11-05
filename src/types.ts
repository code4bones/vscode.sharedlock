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

export enum UIMessageType {
    lockRequest = "lockreq",
    lockReply   = "lockrep"  
}

export interface UIMessagePayloadLockRequest {
    file:string;
}

export interface UIMessagePayloadLockReply {
    granted:boolean;
    file:string;
}

export interface UIMessageDef<T> {
    type:UIMessageType
    from:Tag;
    message:string;
    payload:T;
}

export type UILockRequestMessage = UIMessageDef<UIMessagePayloadLockRequest>;
export type UILockReplyMessage = UIMessageDef<UIMessagePayloadLockReply>;

export type UIMessage = UILockReplyMessage | UILockRequestMessage;
