
export interface UpdateState {
    id:string;
    action:"add" | "remove";
    class:string;
}

export interface ConnectionSettings {
    host:string;
    port:number;
    username:string;
    password:string;
}

export interface CommonSettings {
    tunnel?:boolean;
    autoconnect?:boolean;
    welcome?:boolean;
}

export interface RedisSettings extends ConnectionSettings {
    db:number;
}

export interface SSHSettings extends ConnectionSettings {
    remoteRedisPort:number;
    localRedisPort:number;
    privateKey:string;
}

export interface Settings  {
    common:CommonSettings;
    redis:RedisSettings;
    ssh:SSHSettings;
}


export const configCommonKeys     = ["tunnel","autoconnect","welcome"];
export const configBaseKeys   = ["host","port","username","password"];
export const configRedisKeys  = [...configBaseKeys,"db"]
export const configSshKeys    = [...configBaseKeys,"privateKey","remoteRedisPort","localRedisPort"] 

export const configKeys = {
    configBaseKeys,
    configCommonKeys,
    configRedisKeys,
    configSshKeys
}
