// CajaCurso para Windows: ventana de escritorio que abre la plataforma web.
// La URL se toma de config.json (appUrl) o de la variable APP_URL.
const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

let appUrl = process.env.APP_URL;
if (!appUrl) {
  try { appUrl = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8")).appUrl; } catch { /* usa el valor por defecto */ }
}
appUrl = (appUrl || "http://localhost:3000").replace(/\/$/, "");
const origin = new URL(appUrl).origin;

if (!app.requestSingleInstanceLock()) app.quit();

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 380, minHeight: 600,
    title: "CajaCurso", backgroundColor: "#f6f8f7", autoHideMenuBar: true,
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  Menu.setApplicationMenu(null);

  // Los enlaces a otros sitios (Mercado Pago, Google, WhatsApp) se abren en el navegador del sistema
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (new URL(url).origin === origin) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (new URL(url).origin !== origin) { e.preventDefault(); shell.openExternal(url); }
  });
  win.webContents.on("did-fail-load", (_e, code, _d, _u, isMainFrame) => {
    if (isMainFrame && code !== -3) win.loadFile(path.join(__dirname, "offline.html"), { query: { retry: appUrl } });
  });
  win.loadURL(appUrl + "/app");
}

app.on("second-instance", () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
