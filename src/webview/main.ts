import { vsCodeCheckbox,vsCodePanelTab, vsCodeTextField,vsCodeButton } from "@vscode/webview-ui-toolkit";
import { provideVSCodeDesignSystem, Button } from "@vscode/webview-ui-toolkit";
import * as ui from "@vscode/webview-ui-toolkit";

provideVSCodeDesignSystem().register(
    ui.vsCodeButton(),
    ui.vsCodeCheckbox(),
    ui.vsCodeTextField(),
    ui.vsCodePanels(),
    ui.vsCodePanelView(),
    ui.vsCodePanelTab(),
    ui.vsCodeLink(),
);

const vscode = acquireVsCodeApi();

window.addEventListener("load", main);

function main() {
    const btnTestRedis = document.getElementById("redis-test") as Button;
    btnTestRedis?.addEventListener("click", testRedisConnection);
    setVSCodeMessageListener();

    vscode.postMessage({command: "get-config"});
}



function testRedisConnection() {
    vscode.postMessage({command: "test-redis",payload:getConfig()});
}

function getConfig() {
    const redisKeys = ["redisHost","redisPort","redisDB","redisUsername","redisPassword"];
    const redis = redisKeys.reduce((agg,k)=>({
        ...agg,[k]:(document.getElementById(k) as ui.TextField).value
    }),{});
    return {
        redis,
    }
}

function setConfig(cfg) {
    console.log("setConfig",cfg);
    Object.entries(cfg.redis).map(([k,v])=>{
        const el = document.getElementById(k) as ui.TextField;
        if ( el )
            el.value = `${v}`
        })

}

function setVSCodeMessageListener() {
    window.addEventListener("message",(event)=>{
        const {command,payload} = event.data;
        console.log("GOT MESSAGE",event.data);
        switch ( command ) {
            case 'set-config':
                setConfig(payload);
                return;
            case 'redis-connect':
                console.log("WOW !");
                break;

        }
    })
}