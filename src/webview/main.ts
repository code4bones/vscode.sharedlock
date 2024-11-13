// import { vsCodeCheckbox,vsCodePanelTab, vsCodeTextField,vsCodeButton } from "@vscode/webview-ui-toolkit";
import { provideVSCodeDesignSystem, Button } from "@vscode/webview-ui-toolkit";
import * as ui from "@vscode/webview-ui-toolkit";
import {configKeys, Settings, UpdateState} from "../config/config";

provideVSCodeDesignSystem().register(
    ui.vsCodeButton(),
    ui.vsCodeCheckbox(),
    ui.vsCodeTextField(),
    ui.vsCodePanels(),
    ui.vsCodePanelView(),
    ui.vsCodePanelTab(),
    ui.vsCodeLink(),
    ui.vsCodeTag(),
    ui.vsCodeProgressRing()
);

const vscode = acquireVsCodeApi();

window.addEventListener("load", main);

function main() {
    const btnTestRedis = document.getElementById("redis-save") as Button;
    btnTestRedis?.addEventListener("click", () => vscode.postMessage({command: "redis-test",payload:getConfig()}));

    const btnTestSSH = document.getElementById("ssh-save") as Button;
    btnTestSSH?.addEventListener("click", () => vscode.postMessage({command: "ssh-test",payload:getConfig()}));

    const chkTunnel = document.getElementById("common-tunnel") as ui.Checkbox
    chkTunnel?.addEventListener("click", () => vscode.postMessage({command: "toggle-tunnel",payload:getConfig()}));

    setVSCodeMessageListener();

    vscode.postMessage({command: "get-config"});
}

function toggleTunnel(cfg:Settings) {
    const viaSSH = document.getElementById("via-ssh") as HTMLSpanElement;
    viaSSH.textContent = cfg.common?.tunnel ? ` [ via SSH on ${cfg.ssh.host} ] ` : " ";

    const btnTestSSH = document.getElementById("ssh-save") as Button;
    btnTestSSH.textContent = cfg.common.tunnel ? 'Save and Test connection' : 'Save'; 
}

function updateState(state:UpdateState) {
    const el = document.getElementById(state.id) as HTMLDivElement;
    if ( state.action === "add" ) {
        el?.classList.add(state.class)
    } else {
        el?.classList.remove(state.class)
    }
}

function getConfig() {
    const redis = configKeys.configRedisKeys.reduce((agg,k)=>({
        ...agg,[k]:(document.getElementById(`redis-${k}`) as ui.TextField)?.value
    }),{}) as Settings["redis"];
    const ssh = configKeys.configSshKeys.reduce((agg,k)=>({
        ...agg,[k]:(document.getElementById(`ssh-${k}`) as ui.TextField)?.value
    }),{}) as Settings["ssh"];
    const common = configKeys.configCommonKeys.reduce((agg,k)=>({
        ...agg,[k]:(document.getElementById(`common-${k}`) as ui.Checkbox)?.checked
    }),{}) as Settings["common"];
    return {
        redis,
        common,
        ssh,
    }
}

function setConfig(cfg:Settings) {
    console.log("setConfig",cfg);

    toggleTunnel(cfg);

    const setValue = (names:string[]) => {
        names.forEach(name => Object.entries(cfg[name]).map(([k,v])=>{
            const el = document.getElementById(`${name}-${k}`)!;
            switch ( el.id ) {
                case "common-tunnel":
                case "common-autoconnect":
                    (el as ui.Checkbox).checked = Boolean(v);
                    break;
                default:
                    (el as ui.TextField).value = `${v}`
                    break;
            }
        }))
    }
    setValue(["ssh","redis","common"]);
}

function setVSCodeMessageListener() {
    window.addEventListener("message",(event)=>{
        const {command,payload} = event.data;
        console.log("GOT MESSAGE",event.data);
        switch ( command ) {
            case 'set-config':
                setConfig(payload);
                return;
            case 'toggle-tunnel':
                toggleTunnel(payload);
                return;
            case 'redis-connect':
                console.log("WOW !");
                break;
            case 'update-state':
                updateState(payload)
                break;
        }
    })
}