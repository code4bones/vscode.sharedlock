import * as vs from "vscode";
import { getNonce } from "../utils/getNonce";
import { getUri } from "../utils/getUri";
import { getConfig, setConfig } from "../utils/getConfig";
import { testRedis } from "../utils/testRedis";

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
                        payload:getConfig(),
                    });
                    break;
                case "test-redis":
                    testRedis(message.payload)
                    .then((res)=>{
                        if ( res ) { 
                            vs.window.showErrorMessage(`Cannot connect ${res}`);
                        } else {
                            vs.window.showInformationMessage(`Connected`);
                        }
                        setConfig(message.payload);
                        webview.postMessage({
                            command:"redis-connect",
                            payload:res,
                        });
                    })
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
                        <div class="cont-row">
                            <section class="cont-col">
                                <vscode-text-field id="redisHost" placeholder="127.0.0.1">Address</vscode-text-field>
                                <vscode-text-field id="redisPort" type="number" placeholder="6379" size="50">Port</vscode-text-field>
                                <vscode-text-field id="redisDB" type="number" placeholder="0" size="50">Database</vscode-text-field>
                            </section>
                            <section class="cont-col spacer">
                                <vscode-text-field id="redisUsername" placeholder="none">Username</vscode-text-field>
                                <vscode-text-field id="redisPassword" placeholder="none">Password</vscode-text-field>
                                <p>
                                <vscode-link id="redis-test">
                                Test
                                </vscode-link>
                                connection !
                                </p>
                            </section>
                        </div>
                    </vscode-panel-view>
                    <vscode-panel-view id="ssh-view">
                    <section class="cont-col">
                        <vscode-checkbox>Enable SSH Tunnel</vscode-checkbox>
                        <section class="cont-row">
                            <vscode-text-field id="sshHost" placeholder="127.0.0.1">Host</vscode-text-field>
                            <vscode-text-field class="spacer" id="sshPort" type="number" placeholder="22" size="5" maxlength="5">
                                Port
                            </vscode-text-field>
                        </section>
                        <vscode-text-field id="sshLogin" size="10">Username</vscode-text-field>
                        <vscode-text-field id="pubKey"   placeholder="$HOME/.ssh/id_rsa" size="50">Private key</vscode-text-field>

                        <section class="cont-row">
                            <vscode-text-field id="remoteRedisPost" type="number" placeholder="6379" size="10">Remote Redis Port</vscode-text-field>
                            <vscode-text-field class="spacer" id="localRedisPort" type="number"  placeholder="6379" size="10">Bind to local port</vscode-text-field>
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