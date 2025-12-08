// Generates cartoon-style placeholder PNGs for Snapadile using pureimage
import fs from "node:fs";
import path from "node:path";
import PImage from "pureimage";

const outDir = path.resolve(process.cwd(), "apps/player-web/public/assets/snapadile");
await fs.promises.mkdir(outDir, { recursive: true });

async function save(img, filePath) {
  const stream = fs.createWriteStream(filePath);
  await PImage.encodePNGToStream(img, stream);
}

// Create raft: wood-like circle with rope accent
async function createRaft() {
  const size = 384; // square
  const img = PImage.make(size, size);
  const ctx = img.getContext("2d");

  // Background transparent
  ctx.clearRect(0, 0, size, size);

  // Wood circle
  ctx.fillStyle = "#A36A3C";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2);
  ctx.fill();

  // Darker wood rings
  ctx.strokeStyle = "#7C4F2D";
  ctx.lineWidth = size * 0.04;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.38, 0, Math.PI * 2);
  ctx.stroke();

  // Rope across
  ctx.strokeStyle = "#D9B26D";
  ctx.lineWidth = size * 0.055;
  ctx.beginPath();
  ctx.moveTo(size * 0.25, size * 0.35);
  ctx.lineTo(size * 0.75, size * 0.65);
  ctx.stroke();

  // Highlights
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = size * 0.03;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.27, Math.PI * 1.7, Math.PI * 2);
  ctx.stroke();

  const out = path.join(outDir, "raft.png");
  await save(img, out);
  return out;
}

// Create croc: rounded body with head, eye, teeth, and light belly
async function createCroc() {
  const w = 640,
    h = 240;
  const img = PImage.make(w, h);
  const ctx = img.getContext("2d");
  ctx.clearRect(0, 0, w, h);

  // Body
  const bodyR = 30;
  ctx.fillStyle = "#2EA043";
  roundRect(ctx, 0, h * 0.22, w * 0.78, h * 0.56, bodyR);
  ctx.fill();

  // Belly
  ctx.fillStyle = "#5CC16A";
  roundRect(ctx, w * 0.1, h * 0.55, w * 0.45, h * 0.18, 20);
  ctx.fill();

  // Head snout
  ctx.fillStyle = "#2EA043";
  roundRect(ctx, w * 0.65, h * 0.32, w * 0.3, h * 0.36, 28);
  ctx.fill();

  // Mouth line
  ctx.strokeStyle = "#164B2B";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(w * 0.68, h * 0.5);
  ctx.lineTo(w * 0.92, h * 0.5);
  ctx.stroke();

  // Teeth
  ctx.fillStyle = "#FFFFFF";
  for (let i = 0; i < 6; i++) {
    const x = w * 0.7 + i * (w * 0.035);
    triangle(ctx, x, h * 0.5, 10, 16, true);
  }

  // Eye
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(w * 0.83, h * 0.4, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1B7A33";
  ctx.beginPath();
  ctx.arc(w * 0.83, h * 0.4, 6, 0, Math.PI * 2);
  ctx.fill();

  // Spots
  ctx.fillStyle = "#1B7A33";
  for (let i = 0; i < 5; i++) {
    const x = w * 0.1 + i * (w * 0.12);
    const y = h * 0.36 + (i % 2) * 10;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  const out = path.join(outDir, "croc.png");
  await save(img, out);
  return out;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function triangle(ctx, x, y, w, h, down = false) {
  ctx.beginPath();
  if (down) {
    ctx.moveTo(x, y);
    ctx.lineTo(x + w / 2, y + h);
    ctx.lineTo(x - w / 2, y + h);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x + w / 2, y - h);
    ctx.lineTo(x - w / 2, y - h);
  }
  ctx.closePath();
  ctx.fill();
}

await createRaft();
await createCroc();
console.log("Snapadile assets generated at", outDir);
