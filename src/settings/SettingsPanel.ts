import * as vs from "vscode";
import { getNonce } from "../utils/getNonce";
import { getUri } from "../utils/getUri";
import { loadConfig, saveConfig } from "../utils/getConfig";
import { testRedis } from "../utils/testRedis";
import { createTunnel } from "../utils/tunnel";

export class SettingsPanel {
    public static currentPanel: SettingsPanel | undefined;
    private readonly _panel: vs.WebviewPanel;
    private _disposables: vs.Disposable[] = [];
    private _ctx: vs.ExtensionContext;

    private constructor(panel: vs.WebviewPanel,ctx:vs.ExtensionContext) {
        this._panel = panel;
        this._ctx = ctx;
        this._panel.webview.html = this._getWebviewContent(this._panel.webview,ctx.extensionUri);        
        this._setWebviewMessageListener(this._panel.webview);
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);        
    }

    public static render(ctx:vs.ExtensionContext) {
        const extensionUri = ctx.extensionUri; 
        if (SettingsPanel.currentPanel) {
          SettingsPanel.currentPanel._panel.reveal(vs.ViewColumn.One);
        } else {
          const panel = vs.window.createWebviewPanel("settings", "Settings", vs.ViewColumn.One, {
            // Empty for now
            enableScripts: true,
            // Restrict the webview to only load resources from the `out` directory
            localResourceRoots: [vs.Uri.joinPath(extensionUri, "out")],

          });    
          SettingsPanel.currentPanel = new SettingsPanel(panel,ctx);
        }
    }

    private _setWebviewMessageListener(webview:vs.Webview) {
        webview.onDidReceiveMessage(
          (message: any) => {
            console.log("MESSAGE FROM WEB",message);
            const command = message.command;
    
            switch (command) {
                case "get-config":
                    webview.postMessage({
                        command:"set-config",
                        payload:loadConfig(),
                    });
                    break;
                case "ssh-test":
                  saveConfig(message.payload);
                  createTunnel(message.payload)
                  .then((server)=>{
                      vs.window.showInformationMessage(`SSH connected`);
                      server.close();
                  })
                  .catch((e)=>{
                    vs.window.showErrorMessage(`SSH: ${e}`);
                  })
                  break;
                case "redis-test":
                  saveConfig(message.payload);
                  testRedis(message.payload)
                    .then((res)=>{
                        if ( res ) { 
                            vs.window.showErrorMessage(`Cannot connect ${res}`);
                        } else {
                            vs.window.showInformationMessage(`Connected`);
                        }
                        webview.postMessage({
                            command:"redis-connect",
                            payload:res,
                        });
                    })
                    break;
                  case 'toggle-tunnel':
                      break;
              // Add more switch case statements here as more webview message commands
              // are created within the webview context (i.e. inside src/webview/main.ts)
            }
          },
          undefined,
          this._disposables
        );
    }    
        
    private _getWebviewContent(webview: vs.Webview, extensionUri: vs.Uri) {
        const webviewUri = getUri(webview, extensionUri, ["out", "webview.js"]);
        const cssStyle = webview.asWebviewUri(vs.Uri.joinPath(extensionUri, "out", "style.css"))
        
        const nonce = getNonce();
    
        // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
        return /*html*/ `
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
              <link rel="stylesheet" type="text/css" href="${cssStyle}" />
              <title>SharedLock Settings</title>
            </head>
            <body>
                <h1>SharedLock Settings</h1>
                <vscode-panels>
                    <vscode-panel-tab id="redis-tab">Redis</vscode-panel-tab>
                    <vscode-panel-tab id="ssh-tab">SSH</vscode-panel-tab>
                    <vscode-panel-view id="redis-view">
                        <div class="cont-col">
                        <div class="cont-row">
                            <section class="cont-col">
                                <vscode-text-field id="redis-host" placeholder="127.0.0.1">Address</vscode-text-field>
                                <vscode-text-field id="redis-port" type="number" placeholder="6379" size="50">Port</vscode-text-field>
                                <vscode-text-field id="redis-db" type="number" placeholder="0" size="50">Database</vscode-text-field>
                            </section>
                            <section class="cont-col spacer">
                                <vscode-text-field id="redis-username" placeholder="none">Username</vscode-text-field>
                                <vscode-text-field id="redis-password" placeholder="none">Password</vscode-text-field>
                            </section>
                        </div>
                        <p>
                        Save and
                        <vscode-link id="redis-save">
                        Test
                        </vscode-link>
                        Redis connection.
                        </p>    
                    </div>
                    </vscode-panel-view>
                    <vscode-panel-view id="ssh-view">
                    <section class="cont-col">
                        <vscode-checkbox id="common-tunnel">Enable SSH Tunnel</vscode-checkbox>
                        <section class="cont-row">
                            <vscode-text-field id="ssh-host" placeholder="127.0.0.1">Host</vscode-text-field>
                            <vscode-text-field class="spacer" id="ssh-port" type="number" placeholder="22" size="5" maxlength="5">
                                Port
                            </vscode-text-field>
                        </section>
                        <vscode-text-field id="ssh-username" size="10">Username</vscode-text-field>
                        <vscode-text-field id="ssh-password" size="10">Password</vscode-text-field>
                        <vscode-text-field id="ssh-privateKey"   placeholder="$HOME/.ssh/id_rsa" size="50">Private key</vscode-text-field>

                        <section class="cont-row">
                            <vscode-text-field id="ssh-remoteRedisPort" type="number" placeholder="6379" size="10">Remote Redis Port</vscode-text-field>
                            <vscode-text-field id="ssh-localRedisPort" class="spacer"  type="number"  placeholder="6379" size="10">Bind to local port</vscode-text-field>
                        </section>
                        <section>
                        <p>
                        Save and
                        <vscode-link id="ssh-save">
                        Test
                        </vscode-link>
                        connection
                        </p>
                </section>
                    </section>
                    </vscode-panel-view>
                </vscode-panels>
              <section>
              </section>
              <script type="module" nonce="${nonce}" src="${webviewUri}"></script>
            </body>
          </html>
        `;
    }

    public dispose() {
        SettingsPanel.currentPanel = undefined;
    
        this._panel.dispose();
    
        while (this._disposables.length) {
          const disposable = this._disposables.pop();
          if (disposable) {
            disposable.dispose();
          }
        }
    }    
}