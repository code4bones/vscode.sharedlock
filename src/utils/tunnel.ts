import { Settings } from "../config/config";
import { existsSync, readFileSync } from "fs";
import { Client, ConnectConfig } from "ssh2";
import net from "net";

export function createSSH(cfg:Settings) {
    const config : ConnectConfig = {
        username:cfg.ssh.username,
        password:cfg.ssh.password,
        host:cfg.ssh.host,
        port:cfg.ssh.port,
        privateKey:existsSync(cfg.ssh.privateKey) ?  readFileSync(cfg.ssh.privateKey) : undefined,
    }
    const conn = new Client();
    return {conn,config};
}

export function createTunnel(cfg:Settings) {
    return new Promise<net.Server | undefined>((resolve,reject)=>{
        if ( !cfg.common.tunnel ) {
            return resolve(undefined);
        }
        const {conn,config} = createSSH(cfg);
        console.log("Connecting...")
        conn.on("ready",()=>{
            const server = net.createServer((socket)=>{
                conn.forwardOut("127.0.0.1",cfg.ssh.localRedisPort,"127.0.0.1",cfg.ssh.remoteRedisPort,(err,channel)=>{
                        if ( err ) {
                            console.log("ERROR FORWARD",err);
                        } else {
                            console.log("FORWARD ENABLED...");
                            socket.pipe(channel).pipe(socket);
                        }
                    });
                })
                .on("listening",()=>{
                    console.log("SERVER listen")
                })
                .on("connection",()=>{
                    console.log("SERVER - conneciton");
                })
                .on("error",(e)=>{
                    console.log("SERVER - error",e);
                    reject(e.message)
                })
                .on("close",()=>{
                    console.log("SERVER - closed");
                    conn.destroy()
                    // conn.end();
                })
                .listen(cfg.ssh.localRedisPort,"127.0.0.1",()=>{
                    console.log("SERVER STARTED");
                    resolve(server)
                });
            }).on("error",(e)=>{
                console.log("SSH ERROR",e)
                reject(e.message);
            }).on("end",()=>{
                console.log("SSH END")
            }).on("close",()=>{
                console.log("SSH CLOSE")
            }).on("timeout",()=>{
                console.log("SSH TIMEOUT")
            })
            .connect(config);
        })
}
/*
export function testSSH(cfg:Settings) {
    return new Promise((resolve,reject)=>{
        const controller = new AbortController()
        const {signal} = controller;
        const {cmd,args} = tunnelCommand(cfg)
        args.push('id')
        console.log("Executing",`${cmd} ${args.join(" ")}`)
        const ssh = spawn(cmd,args,{
            shell:true,
            stdio:['pipe','pipe',process.stdout]
        });
        ssh.stdout.on("data",(m)=>{
            console.log(">",m.toString("utf8"));
        })
        ssh.on("error",(e)=>{
            console.log("ERROR",e);
            reject({code:-1,error:e.message});
        })
        ssh.on("close",(code)=>{
            resolve({code});
            console.log("CLOSED !",code)
        })
    })
}
*/