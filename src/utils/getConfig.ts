import {ConfigurationTarget, ExtensionContext,workspace} from "vscode";
import { configRedisKeys,configSshKeys,configCommonKeys,Settings } from "../config/config";


export function loadConfig(ctx?:ExtensionContext) {
    const redis = configRedisKeys.reduce((agg,k)=>({
        ...agg,[k]:workspace.getConfiguration().get(`sharedlock.redis-${k}`) as string
    }),{}) as Settings["redis"];

    const ssh = configSshKeys.reduce((agg,k)=>({
        ...agg,[k]:workspace.getConfiguration().get(`sharedlock.ssh-${k}`) as string
    }),{}) as Settings["ssh"];

    const common = configCommonKeys.reduce((agg,k)=>({
        ...agg,[k]:workspace.getConfiguration().get(`sharedlock.common-${k}`) as string
    }),{}) as Settings["common"];
    
    const cfg:Settings = {
        redis,
        ssh,
        common,
    }
    console.log("Read Config",cfg);
    return cfg;
}

export function saveConfig(cfg:Settings) {
    console.log("Write Config",cfg);
    Object.entries(cfg.redis).map(([k,v])=>{
        workspace.getConfiguration().update(`sharedlock.redis-${k}`,v,false);
    })
    Object.entries(cfg.ssh).map(([k,v])=>{
        workspace.getConfiguration().update(`sharedlock.ssh-${k}`,v,false);
    })
    Object.entries(cfg.common).map(([k,v])=>{
        workspace.getConfiguration().update(`sharedlock.common-${k}`,v,false);
    })
}