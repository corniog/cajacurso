// Apunta las apps (Windows y Android) a la URL pública de tu plataforma.
// Uso: node scripts/set-app-url.mjs https://tudominio.cl
import fs from "node:fs";
const raw = process.argv[2];
if (!raw || !/^https?:\/\//.test(raw)) { console.error("Uso: node scripts/set-app-url.mjs https://tudominio.cl"); process.exit(1); }
const url = raw.replace(/\/$/, "");
const https = url.startsWith("https://");
fs.writeFileSync("desktop/config.json", JSON.stringify({ appUrl: url }, null, 2) + "\n");
const cap = JSON.parse(fs.readFileSync("mobile/capacitor.config.json", "utf8"));
cap.server.url = `${url}/app`;
cap.server.cleartext = !https;
fs.writeFileSync("mobile/capacitor.config.json", JSON.stringify(cap, null, 2) + "\n");
console.log("Apps apuntando a", url);
