import {ExtensionContext,workspace} from "vscode";

export function getConfig(ctx?:ExtensionContext) {
    const redisKeys = ["redisHost","redisPort","redisDB","redisUsername","redisPassword"];
    const redis = redisKeys.reduce((agg,k)=>({
        ...agg,[k]:workspace.getConfiguration().get(k) as string
    }),{});
    return {
        redis,
    }
}

export function setConfig(cfg:any) {
    Object.entries(cfg.redis).map(([k,v])=>{
        workspace.getConfiguration().update(k,v);
    })
}