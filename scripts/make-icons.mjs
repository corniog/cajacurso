// Genera los íconos PNG (PWA, Windows y Android) a partir de public/icon.svg
import sharp from "sharp";
import fs from "node:fs";
const svg = fs.readFileSync("public/icon.svg");
const out = [
  ["public/icon-192.png", 192], ["public/icon-512.png", 512],
  ["desktop/build/icon.png", 512], ["mobile/resources/icon.png", 1024],
];
for (const [file, size] of out) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(file);
  console.log("OK", file, size);
}
