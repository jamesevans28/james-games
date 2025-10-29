import fs from "node:fs";
import path from "node:path";
import PImage from "pureimage";

const outDir = path.resolve(process.cwd(), "public/assets/car-crash");
await fs.promises.mkdir(outDir, { recursive: true });

async function save(img, file) {
  const stream = fs.createWriteStream(file);
  await PImage.encodePNGToStream(img, stream);
}

function drawCar(colorBody, colorAccent) {
  const w = 220,
    h = 360;
  const img = PImage.make(w, h);
  const ctx = img.getContext("2d");
  ctx.clearRect(0, 0, w, h);

  // Body
  roundRect(ctx, 30, 10, w - 60, h - 20, 28);
  ctx.fillStyle = colorBody;
  ctx.fill();

  // Windscreen
  ctx.fillStyle = "#bfe9ff";
  roundRect(ctx, 50, 40, w - 100, 90, 18);
  ctx.fill();

  // Bonnet stripe
  ctx.fillStyle = colorAccent;
  roundRect(ctx, w / 2 - 18, 140, 36, 160, 12);
  ctx.fill();

  // Wheels
  ctx.fillStyle = "#222";
  roundRect(ctx, 8, 60, 24, 110, 12);
  ctx.fill();
  roundRect(ctx, w - 32, 60, 24, 110, 12);
  ctx.fill();
  roundRect(ctx, 8, h - 170, 24, 110, 12);
  ctx.fill();
  roundRect(ctx, w - 32, h - 170, 24, 110, 12);
  ctx.fill();

  // Headlights
  ctx.fillStyle = "#fff6a1";
  roundRect(ctx, 70, h - 50, 40, 22, 8);
  ctx.fill();
  roundRect(ctx, w - 110, h - 50, 40, 22, 8);
  ctx.fill();

  return img;
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

const player = drawCar("#e53935", "#ffffff");
await save(player, path.join(outDir, "player.png"));

const car1 = drawCar("#1e88e5", "#b3e5fc");
await save(car1, path.join(outDir, "car1.png"));

const car2 = drawCar("#43a047", "#c8e6c9");
await save(car2, path.join(outDir, "car2.png"));

console.log("Generated car-crash assets at", outDir);
