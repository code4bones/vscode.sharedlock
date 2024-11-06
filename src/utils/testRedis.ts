import Redis, {RedisOptions } from "ioredis";
import { logger } from "../logger";

export async function testRedis(cfg:any) {
    const {redis} = cfg;
    return new Promise((ok,cancel)=>{
        const opts:RedisOptions = {
            host:redis.redisHost,
            port:redis.redisPort,
            db:redis.redisDB,            
            maxRetriesPerRequest:1,
            username:redis.redisUsername,
            password:redis.redisPassword,
            reconnectOnError:()=>false,
        }
        const rd = new Redis(opts);
        rd.on("error",(err)=>{
            logger.error(`Testing redis connection: ${err.message}`);
            rd.disconnect();            
            ok(err.message);
        }) 
        rd.on("ready",()=>{
            logger.info(`Testing redis connection: connected`)
            rd.disconnect();
            ok(false);
        })
    })
}