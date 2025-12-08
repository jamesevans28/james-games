import Phaser from "phaser";
import { dispatchGameOver } from "../../utils/gameEvents";

const GAME_ID = "ho-ho-home-delivery";

export default class HoHoHomeDeliveryGame extends Phaser.Scene {
  private santa!: Phaser.GameObjects.Container;
  private santaX = 90;
  private santaY = 120;
  private santaDir = 1;
  private score = 0;
  private lives = 3;
  private highScore = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private livesUI!: Phaser.GameObjects.Container;
  private groundY = 920;
  private scrollSpeed = 160;
  private chimneyZones!: Phaser.Physics.Arcade.StaticGroup;
  private chimneyVisuals: Phaser.GameObjects.Container[] = [];
  private lastChimneyX = 0;
  private presents!: Phaser.Physics.Arcade.Group;
  private running = true;

  constructor() {
    super("HoHoHomeDeliveryGame");
  }

  preload() {}

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.groundY = Math.min(920, h - 40);

    // Background gradient
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x021024, 0x021024, 0x87ceeb, 0x87ceeb, 1);
    bg.fillRect(0, 0, w, h);
    bg.setDepth(-100);

    // Snow/star particles
    this.createSnow();

    // Ground
    const ground = this.add.rectangle(w / 2, this.groundY + 20, w, 40, 0x0e2a15).setDepth(-10);
    (ground as any).setStrokeStyle?.(2, 0x000000);

    // UI
    this.highScore = Number(localStorage.getItem(`${GAME_ID}-best`) || 0);
    this.scoreText = this.add
      .text(16, 16, `Score: ${this.score}`, { fontSize: "24px", color: "#ffffff" })
      .setStroke("#000000", 3)
      .setDepth(1000);
    this.livesUI = this.add.container(w - 16, 16).setDepth(1000);
    this.renderLives();

    // Santa in sleigh (simple vector art)
    this.santa = this.createSanta();
    this.santa.setPosition(this.santaX, this.santaY).setDepth(10).setScale(2);

    // Groups
    // Static group for roof hitboxes
    this.chimneyZones = this.physics.add.staticGroup();
    // Tiny texture for static sprites used as invisible hitboxes
    if (!this.textures.exists("hb")) {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 4, 4);
      g.generateTexture("hb", 4, 4);
      g.destroy();
    }
    this.presents = this.physics.add.group();

    // Generate initial chimneys off to the right (spaced wider for gaps)
    this.lastChimneyX = w * 0.6;
    for (let i = 0; i < 4; i++) this.spawnChimney(this.lastChimneyX + i * 320);

    // Collisions/overlaps
    this.physics.add.overlap(
      this.presents,
      this.chimneyZones,
      (present, zone) => this.onPresentIntoChimney(present as Phaser.Physics.Arcade.Image, zone),
      undefined,
      this
    );

    // Input
    this.input.on("pointerdown", () => this.dropPresent());
  }

  update(_time: number, delta: number) {
    if (!this.running) return;
    const w = this.scale.width;

    // Move Santa subtly left-right within a band
    this.santaX += this.santaDir * 40 * (delta / 1000);
    if (this.santaX > 140) this.santaDir = -1;
    if (this.santaX < 70) this.santaDir = 1;
    this.santa.setPosition(this.santaX, this.santaY);

    // Scroll chimneys and visuals
    const dx = -this.scrollSpeed * (delta / 1000);
    // Speed up marginally as score increases
    this.scrollSpeed = Math.min(400, 180 + Math.floor(this.score / 5) * 15);
    this.chimneyZones.children.iterate((c: any) => {
      if (!c) return true;
      c.x += dx;
      // static body must be refreshed when moved
      if (typeof c.refreshBody === "function") c.refreshBody();
      if (c.x < -60) c.destroy();
      return true;
    });
    this.chimneyVisuals.forEach((v) => {
      v.x += dx;

      const mgr = v.getData("smokeMgr");

      if (mgr) mgr.x += dx;
    });
    // Prune visuals
    this.chimneyVisuals = this.chimneyVisuals.filter((v) => {
      if (v.x < -200) {
        // destroy any attached smoke particle manager
        try {
          const mgr = (v as any).getData?.("smokeMgr");
          if (mgr && typeof mgr.destroy === "function") mgr.destroy();
        } catch {}
        v.destroy();
        return false;
      }
      return true;
    });

    // Spawn new chimneys when needed
    if (this.lastChimneyX + dx < w + 80) {
      this.lastChimneyX += 300 + Phaser.Math.Between(-60, 60);
      this.spawnChimney(this.lastChimneyX);
    } else {
      this.lastChimneyX += dx;
    }

    // Check presents for ground hit
    this.presents.children.iterate((p: any) => {
      if (!p) return true;
      if (p.y >= this.groundY - 8) {
        // Missed
        this.onPresentMiss(p as Phaser.Physics.Arcade.Image);
      }
      return true;
    });
  }

  private createSanta() {
    const c = this.add.container(0, 0);
    const g = this.add.graphics();
    // Sleigh
    g.fillStyle(0x8b0000, 1);
    g.fillRoundedRect(-36, -8, 72, 22, 6);
    g.lineStyle(3, 0x000000, 1);
    g.strokeRoundedRect(-36, -8, 72, 22, 6);
    // Runners
    g.lineStyle(3, 0xffd700, 1);
    g.beginPath();
    g.moveTo(-30, 16);
    g.lineTo(28, 16);
    g.strokePath();
    // Santa head (white) and red hat/body
    g.fillStyle(0xffffff, 1);
    g.fillCircle(-10, -12, 7);
    g.lineStyle(2, 0x000000, 1);
    g.strokeCircle(-10, -12, 7);
    // Red body
    g.fillStyle(0xcc0000, 1);
    g.fillCircle(2, -6, 6);
    g.lineStyle(2, 0x000000, 1);
    g.strokeCircle(2, -6, 6);
    // Red hat with white trim and pom
    g.fillStyle(0xcc0000, 1);
    g.beginPath();
    g.moveTo(-16, -18);
    g.lineTo(-4, -18);
    g.lineTo(-10, -28);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xffffff, 1);
    g.fillRect(-16, -18, 12, 3);
    g.fillCircle(-10, -30, 2.5);
    c.add(g);
    return c;
  }

  private createSnow() {
    const w = this.scale.width;
    const dot = this.add.graphics();
    dot.fillStyle(0xffffff, 1);
    dot.fillCircle(2, 2, 2);
    dot.generateTexture("snow", 4, 4);
    dot.destroy();
    const mgr = this.add.particles(0, 0, "snow", {
      x: { min: 0, max: w },
      y: { min: -20, max: -10 },
      lifespan: { min: 4000, max: 9000 },
      speedY: { min: 40, max: 80 },
      scale: { start: 1, end: 1 },
      quantity: 2,
      frequency: 80,
      alpha: { start: 0.9, end: 0.2 },
      blendMode: "ADD",
    });
    (mgr as any).setDepth?.(-100);
  }

  private spawnChimney(x: number) {
    const houseWidth = Phaser.Math.Between(160, 220);
    const houseHeight = Phaser.Math.Between(110, 150);
    const baseY = this.groundY - 20; // ground rectangle is +20 high

    // Visuals
    const cont = this.add.container(x, baseY);
    const body = this.add.rectangle(0, 0, houseWidth, houseHeight, 0x8b4513).setOrigin(0.5, 1);
    (body as any).setStrokeStyle?.(3, 0x000000);
    // Add a little door
    const door = this.add.rectangle(0, -10, 18, 28, 0x8b4513).setOrigin(0.5, 1);
    (door as any).setStrokeStyle?.(2, 0x000000);
    // Draw roof aligned to body top
    const roofG = this.add.graphics();
    const roofHeight = 44;
    roofG.fillStyle(0x8b4513, 1);
    roofG.lineStyle(3, 0x000000, 1);
    roofG.beginPath();
    roofG.moveTo(-houseWidth / 2, -houseHeight);
    roofG.lineTo(houseWidth / 2, -houseHeight);
    roofG.lineTo(0, -houseHeight - roofHeight);
    roofG.closePath();
    roofG.fillPath();
    roofG.strokePath();
    // Snow cap on roof
    roofG.fillStyle(0xffffff, 0.9);
    roofG.beginPath();
    roofG.moveTo(-houseWidth / 2 + 10, -houseHeight - 4);
    roofG.lineTo(houseWidth / 2 - 10, -houseHeight - 4);
    roofG.lineTo(0, -houseHeight - roofHeight + 8);
    roofG.closePath();
    roofG.fillPath();

    // Chimney position on roof
    const chimneyOffsetX = Phaser.Math.Between(-houseWidth / 4, houseWidth / 4);
    const chimneyHeight = 48;
    const chimneyWidth = 40;
    const chimneyY = -houseHeight - 6; // sits slightly into roof
    const chimneyX = chimneyOffsetX;
    const chimney = this.add
      .rectangle(chimneyX, chimneyY, chimneyWidth, chimneyHeight, 0x6b2c2c)
      .setOrigin(0.5, 1);
    (chimney as any).setStrokeStyle?.(3, 0x000000);

    // Chimney opening visual (top)
    const lip = this.add
      .rectangle(chimneyX, chimneyY - chimneyHeight, chimneyWidth + 12, 8, 0x000000)
      .setOrigin(0.5, 1);
    // Windows on house body
    const winRows = Phaser.Math.Between(1, 2);
    const winCols = Phaser.Math.Between(2, 3);
    const winW = 20,
      winH = 24;
    const gapX = 12,
      gapY = 14;
    const startY = -houseHeight + 20;
    const totalW = winCols * winW + (winCols - 1) * gapX;
    const startX = -totalW / 2 + winW / 2;
    for (let r = 0; r < winRows; r++) {
      for (let c2 = 0; c2 < winCols; c2++) {
        const wx = startX + c2 * (winW + gapX);
        const wy = startY + r * (winH + gapY);
        const lit = Math.random() < 0.7;
        const wRect = this.add
          .rectangle(wx, wy, winW, winH, lit ? 0xffe58a : 0x254061)
          .setOrigin(0.5);
        (wRect as any).setStrokeStyle?.(2, 0x000000);
        cont.add(wRect);
      }
    }

    cont.add([body, door, roofG, chimney, lip]);
    cont.setDepth(1);
    this.chimneyVisuals.push(cont);

    // Decide whether this is a 'bad' house (smoke) - landing here loses a life
    const isBad = Math.random() < 0.18;

    // Physics overlap zone sized to match roof width (more forgiving)
    const zoneY = baseY + (-houseHeight - Math.floor(roofHeight / 2));
    const zoneX = x; // center of the house
    const zWidth = Math.max(40, houseWidth - 10);
    const zHeight = Math.max(16, roofHeight);
    const zone = (
      this.chimneyZones.create(zoneX, zoneY, "hb") as Phaser.Physics.Arcade.Image
    ).setVisible(false);
    zone.setDisplaySize(zWidth, zHeight);
    (zone as any).refreshBody?.();
    zone.setData("isBad", isBad);

    // If bad, create a small smoke emitter above the chimney
    if (isBad) {
      if (!this.textures.exists("smoke")) {
        const sg = this.add.graphics();
        sg.fillStyle(0xffffff, 1);
        sg.fillCircle(4, 4, 4);
        sg.generateTexture("smoke", 8, 8);
        sg.destroy();
      }
      // create a particle manager positioned at (0,0) and create an emitter
      const smokeMgr = this.add.particles(
        x + chimneyX,
        baseY + chimneyY - chimneyHeight - 10,
        "smoke",
        {
          lifespan: { min: 1000, max: 1800 },
          speedY: { min: -50, max: -20 },
          scale: { start: 2.0, end: 0.2 },
          alpha: { start: 0.9, end: 0 },
          frequency: 300,
          quantity: 5,
          blendMode: "ADD",
        }
      );
      smokeMgr.setDepth(50);
      // store manager so we can destroy later
      cont.setData("smokeMgr", smokeMgr);
    }

    this.lastChimneyX = Math.max(this.lastChimneyX, x);
  }

  private dropPresent() {
    if (!this.running) return;
    const present = this.createPresent(this.santaX + 10, this.santaY + 10);
    // slight forward motion
    present.setVelocityX(40);
    this.presents.add(present);
  }

  private createPresent(x: number, y: number) {
    // Random color for present body
    const colors = [0xff6666, 0x66ff66, 0x6666ff, 0xffff66, 0xff66ff, 0x66ffff];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const textureKey = "present_" + color.toString(16);

    if (!this.textures.exists(textureKey)) {
      const g = this.add.graphics();
      g.fillStyle(color, 1);
      g.fillRect(0, 0, 36, 36);
      g.lineStyle(4, 0xffffff, 1);
      g.strokeRect(0, 0, 36, 36);
      // Bow lines
      g.lineStyle(3, 0xffffff, 1);
      g.strokeLineShape(new Phaser.Geom.Line(18, -2, 18, 38));
      g.strokeLineShape(new Phaser.Geom.Line(-2, 18, 38, 18));
      // Bow
      g.fillStyle(0xffffff, 1);
      g.fillCircle(15, -2, 4);
      g.fillCircle(21, -2, 4);
      g.fillRect(16, -4, 4, 4);
      g.lineStyle(2, 0x000000, 1);
      g.strokeCircle(15, -2, 4);
      g.strokeCircle(21, -2, 4);
      g.strokeRect(16, -4, 4, 4);
      g.generateTexture(textureKey, 40, 40);
      g.destroy();
    }
    const img = this.physics.add.image(x, y, textureKey);
    // Make collision circle bigger and visible falling
    img.setCircle(18, 1, 1);
    img.setBounce(0.12);
    // start with a small downward velocity so fall begins slow then gravity accelerates it
    img.setVelocityY(40);
    img.setAngularVelocity(1080);
    img.setCollideWorldBounds(false);
    // slightly bigger display size
    img.setScale(1.2);
    img.setDepth(5);
    return img;
  }
  private onPresentIntoChimney(present: Phaser.Physics.Arcade.Image, zone: any) {
    if (!present.active) return;
    const isBad = !!zone.getData?.("isBad");
    present.destroy();
    if (isBad) {
      // landing on a smoking (bad) chimney costs a life
      this.lives -= 1;
      this.renderLives();
      this.showPopup("Oh no!", zone.x, zone.y - 8, "#ff5555");
      this.playThud();
      if (this.lives <= 0) this.endGame();
      return;
    }
    // good landing
    this.score += 1;
    this.updateScoreUI();
    this.showPopup("+1", present.x, present.y - 12, "#00ff88");
    this.playDing();
  }

  private onPresentMiss(present: Phaser.Physics.Arcade.Image) {
    if (!present.active) return;
    present.destroy();
    this.lives -= 1;
    this.renderLives();
    this.showPopup("Miss!", present.x, this.groundY - 20, "#ff5555");
    this.playThud();
    if (this.lives <= 0) {
      this.endGame();
    }
  }

  private updateScoreUI() {
    this.scoreText.setText(`Score: ${this.score}`);
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem(`${GAME_ID}-best`, String(this.highScore));
    }
  }

  private renderLives() {
    if (!this.livesUI) return;
    this.livesUI.removeAll(true);
    // Use simple text hearts like Snapadile for clarity and consistency
    const hearts = "❤".repeat(Math.max(0, this.lives));
    const txt = this.add
      .text(0, 0, hearts, {
        fontFamily: "sans-serif",
        fontSize: "32px",
        color: "#ff3b3b",
      })
      .setOrigin(1, 0);
    this.livesUI.add(txt);
  }

  private endGame() {
    if (!this.running) return;
    this.running = false;
    // stop scrolling
    this.scrollSpeed = 0;
    // Disable input
    this.input.removeAllListeners();
    // Dispatch event only; ScoreDialog will handle posting
    dispatchGameOver({ gameId: GAME_ID, score: this.score, ts: Date.now() });
    // Pause scene so visuals stay put under dialog
    this.scene.pause();
  }

  private showPopup(text: string, x: number, y: number, color = "#ffffff") {
    const t = this.add.text(x, y, text, {
      fontSize: "28px",
      color,
      stroke: "#000000",
      strokeThickness: 6,
    });
    t.setOrigin(0.5);
    this.tweens.add({ targets: t, y: y - 28, alpha: 0, duration: 700, ease: "Cubic.easeOut" });
    this.time.delayedCall(720, () => t.destroy());
  }

  private playDing() {
    const ctx = (this.sound as any).context as AudioContext | undefined;
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(880, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.26);
  }

  private playThud() {
    const ctx = (this.sound as any).context as AudioContext | undefined;
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(200, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  }
}
