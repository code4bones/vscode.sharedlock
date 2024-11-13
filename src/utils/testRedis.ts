import Redis, {RedisOptions } from "ioredis";
import { logger } from "../logger";
import { Settings } from "../config/config";
import { createTunnel } from "./tunnel";

export async function testRedis(cfg:Settings) {
    const {redis} = cfg;
    return new Promise((ok,cancel)=>{
        const opts:RedisOptions = {
            host:redis.host,
            port:+redis.port,
            db:+redis.db,            
            maxRetriesPerRequest:1,
            username:redis.username,
            password:redis.password,
            reconnectOnError:()=>false,
        }
        createTunnel(cfg)
        .then((server)=>{
            const rd = new Redis(opts);
            rd.on("error",(err)=>{
                logger.error(`Testing redis connection: ${err.message}`);
                rd.disconnect();            
                server?.close();
                ok(err.message);
            }) 
            rd.on("ready",()=>{
                logger.info(`Testing redis connection: connected`)
                rd.disconnect();
                server?.close();
                ok(false);
            })
        });
    })
}