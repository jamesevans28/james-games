import Phaser from "phaser";
import { BasePlatformScene } from "../../../platform/scenes/BasePlatformScene";
import { holdZones } from "../../../platform/input";
import {
  FORMATION_DROP,
  POWERUP_DURATION_MS,
  fireIntervalMs,
  formation,
  hitAlien,
  hitsSide,
  pickIndex,
  rollPowerup,
  shotOffsets,
  waveFor,
  type PowerUpType,
} from "../useCases/rules";

const GAME_WIDTH = 540;
const GAME_HEIGHT = 960;
const PLANET_SURFACE_Y = GAME_HEIGHT - 70;
/** The HUD owns the top ~140 px; the formation starts below it. */
const FORMATION_TOP = 170;
const SIDE_MARGIN = 40;
const PLAYER_Y = GAME_HEIGHT - 80;
const PLAYER_BULLET_SPEED = 500; // px/s, upwards
const ALIEN_BULLET_SPEED = 140; // px/s, downwards
const POWERUP_FALL_SPEED = 90; // px/s
const STAR_SCROLL_SPEED = 60; // px/s
const TAP_NUDGE_DISTANCE = 45;
const HOLD_MOVE_SPEED = 320; // px/s
const TAP_THRESHOLD_MS = 180;
const WAVE_BREAK_MS = 1000;
const MAX_PLAYER_BULLETS = 50;
const MAX_ALIEN_BULLETS = 20;
const BULLET_HIT_RADIUS = 30;
const PLAYER_HIT_RADIUS = 35;
const PICKUP_RADIUS = 40;

const POWERUP_TEXTURE: Record<PowerUpType, string> = {
  rapidFire: "powerup-rapid",
  doubleBullet: "powerup-double",
  shield: "powerup-shield",
};

interface PowerUp {
  sprite: Phaser.GameObjects.Sprite;
  type: PowerUpType;
}

export default class CosmicClashScene extends BasePlatformScene {
  private player!: Phaser.GameObjects.Sprite;
  /** Pooled: bullets are recycled with `get()` and `killAndHide()`, never orphaned. */
  private bullets!: Phaser.GameObjects.Group;
  private alienBullets!: Phaser.GameObjects.Group;
  private aliens!: Phaser.GameObjects.Group;
  private alienHealth = new Map<Phaser.GameObjects.Sprite, number>();
  private powerUps: PowerUp[] = [];
  private stars!: Phaser.GameObjects.TileSprite;
  private waveText!: Phaser.GameObjects.Text;
  private shieldVisual?: Phaser.GameObjects.Arc;
  private alienFireEvent?: Phaser.Time.TimerEvent;
  private rng: () => number = Math.random;

  private score = 0;
  private level = 1;
  private alienSpeed = 0;
  private alienDirection: -1 | 1 = 1;
  private fireCooldown = 0;
  private doubleBulletTimer = 0;
  private rapidFireTimer = 0;
  private shieldTimer = 0;
  /** Scene-clock time of the last power-up drop. */
  private lastPowerUpDrop = 0;
  private moveDirection: -1 | 0 | 1 = 0;
  private levelTransitionPending = false;

  constructor() {
    super("CosmicClash");
  }

  preload() {
    this.load.svg("player", "/assets/cosmic-clash/player.svg", { scale: 1 });
    this.load.svg("alien", "/assets/cosmic-clash/alien.svg", { scale: 1 });
    this.load.svg("alien-strong", "/assets/cosmic-clash/alien-strong.svg", { scale: 1 });
    this.load.svg("bullet", "/assets/cosmic-clash/bullet.svg", { scale: 1 });
    this.load.svg("star", "/assets/cosmic-clash/star.svg", { scale: 1 });
    this.load.svg("powerup-rapid", "/assets/cosmic-clash/powerup-rapid.svg", { scale: 1 });
    this.load.svg("powerup-double", "/assets/cosmic-clash/powerup-double.svg", { scale: 1 });
    this.load.svg("powerup-shield", "/assets/cosmic-clash/powerup-shield.svg", { scale: 1 });
  }

  protected startRun() {
    // The scene object survives restarts: reset every per-run field first.
    this.rng = this.host.rng();
    this.score = 0;
    this.level = 1;
    this.alienSpeed = waveFor(1).speed;
    this.alienDirection = 1;
    this.fireCooldown = 0;
    this.doubleBulletTimer = 0;
    this.rapidFireTimer = 0;
    this.shieldTimer = 0;
    this.shieldVisual = undefined;
    this.alienFireEvent = undefined;
    this.lastPowerUpDrop = this.time.now;
    this.moveDirection = 0;
    this.levelTransitionPending = false;
    this.alienHealth.clear();
    this.powerUps = [];

    // The display list was rebuilt: create everything again.
    this.stars = this.add
      .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, "star")
      .setTileScale(0.5, 0.5)
      .setDepth(-10);
    this.drawPlanetSurface();
    this.player = this.add.sprite(GAME_WIDTH / 2, PLAYER_Y, "player").setScale(0.8);

    this.bullets = this.add.group({ maxSize: MAX_PLAYER_BULLETS });
    this.alienBullets = this.add.group({ maxSize: MAX_ALIEN_BULLETS });
    this.aliens = this.add.group();

    this.hud.setScore(0);
    this.hud.setBest(this.host.best.get());
    this.waveText = this.add
      .text(GAME_WIDTH - 24, 28, "", {
        fontFamily: this.host.fonts.display,
        fontSize: "26px",
        fontStyle: "800",
        color: this.host.colors.sun,
        stroke: this.host.colors.ink,
        strokeThickness: 6,
      })
      .setOrigin(1, 0)
      .setDepth(1000);
    this.showWave();

    // Hold a side to glide, tap a side to nudge; arrows and A/D on desktop.
    holdZones(this, {
      onChange: (direction) => (this.moveDirection = direction),
      onTap: (direction) => this.nudgePlayer(direction),
      tapMs: TAP_THRESHOLD_MS,
    });

    this.createAlienFormation();
    this.startAlienFireLoop();
  }

  update(_time: number, delta: number) {
    if (this.runEnded) return;
    const dt = delta / 1000;

    this.stars.tilePositionY -= STAR_SCROLL_SPEED * dt;

    if (this.moveDirection !== 0) {
      this.player.x = Phaser.Math.Clamp(
        this.player.x + this.moveDirection * HOLD_MOVE_SPEED * dt,
        SIDE_MARGIN,
        GAME_WIDTH - SIDE_MARGIN,
      );
    }

    this.updatePowerUpTimers(delta);
    this.autoFire(delta);
    this.moveAliens(dt);
    if (this.runEnded) return;
    this.moveBullets(dt);
    this.movePowerUps(dt);
    this.checkCollisions();
  }

  private nudgePlayer(direction: -1 | 1) {
    if (this.runEnded) return;
    this.player.x = Phaser.Math.Clamp(
      this.player.x + direction * TAP_NUDGE_DISTANCE,
      SIDE_MARGIN,
      GAME_WIDTH - SIDE_MARGIN,
    );
  }

  private showWave() {
    this.waveText.setText(`Wave ${this.level}`);
  }

  // ---- Firing -------------------------------------------------------------

  private autoFire(delta: number) {
    this.fireCooldown -= delta;
    if (this.fireCooldown > 0) return;
    this.fireCooldown = fireIntervalMs(this.rapidFireTimer > 0);
    for (const dx of shotOffsets(this.doubleBulletTimer > 0)) {
      this.spawnBullet(this.bullets, this.player.x + dx, this.player.y - 20);
    }
  }

  /** Takes a bullet from the pool (or makes one while under the cap). Full pool: no shot. */
  private spawnBullet(
    pool: Phaser.GameObjects.Group,
    x: number,
    y: number,
  ): Phaser.GameObjects.Sprite | null {
    const bullet = pool.get(x, y, "bullet") as Phaser.GameObjects.Sprite | null;
    if (!bullet) return null;
    bullet.setActive(true).setVisible(true).setScale(0.6);
    return bullet;
  }

  private startAlienFireLoop() {
    this.alienFireEvent?.remove(false);
    this.alienFireEvent = undefined;
    this.disableShield();

    const { fireDelayMs } = waveFor(this.level);
    if (fireDelayMs === null || this.runEnded) return;
    this.alienFireEvent = this.time.addEvent({
      delay: fireDelayMs,
      loop: true,
      callback: () => this.alienFire(),
    });
  }

  private alienFire() {
    if (this.runEnded) return;
    const shooters = this.activeSprites(this.aliens);
    const shooter = shooters[pickIndex(shooters.length, this.rng)];
    if (!shooter) return;
    const bullet = this.spawnBullet(this.alienBullets, shooter.x, shooter.y + 20);
    bullet?.setTint(0xff0000); // red enemy shots
  }

  private moveBullets(dt: number) {
    // getChildren() is a fresh array in Phaser 4, so recycling while looping is safe.
    for (const bullet of this.activeSprites(this.bullets)) {
      bullet.y -= PLAYER_BULLET_SPEED * dt;
      if (bullet.y < -10) this.bullets.killAndHide(bullet);
    }
    for (const bullet of this.activeSprites(this.alienBullets)) {
      bullet.y += ALIEN_BULLET_SPEED * dt;
      if (bullet.y > GAME_HEIGHT + 10) this.alienBullets.killAndHide(bullet);
    }
  }

  private recycleAll(pool: Phaser.GameObjects.Group) {
    for (const bullet of this.activeSprites(pool)) pool.killAndHide(bullet);
  }

  // ---- Aliens -------------------------------------------------------------

  private createAlienFormation() {
    const wave = waveFor(this.level);
    this.alienSpeed = wave.speed;
    for (const slot of formation(wave, GAME_WIDTH, FORMATION_TOP)) {
      const alien = this.add
        .sprite(slot.x, slot.y, slot.strong ? "alien-strong" : "alien")
        .setScale(0.7);
      this.aliens.add(alien);
      this.alienHealth.set(alien, slot.health);
    }
  }

  private moveAliens(dt: number) {
    const aliens = this.activeSprites(this.aliens);
    const dx = this.alienSpeed * dt * this.alienDirection;
    const turn = hitsSide(
      aliens.map((a) => a.x),
      dx,
      SIDE_MARGIN,
      GAME_WIDTH - SIDE_MARGIN,
    );
    if (turn) this.alienDirection = this.alienDirection === 1 ? -1 : 1;

    const step = this.alienSpeed * dt * this.alienDirection;
    for (const alien of aliens) {
      if (turn) alien.y += FORMATION_DROP;
      alien.x = Phaser.Math.Clamp(alien.x + step, SIDE_MARGIN, GAME_WIDTH - SIDE_MARGIN);
    }

    if (turn) {
      const landed = aliens.find((a) => a.y >= PLANET_SURFACE_Y);
      if (landed) this.gameOver(landed.x, PLANET_SURFACE_Y - 10);
    }
  }

  private damageAlien(alien: Phaser.GameObjects.Sprite) {
    const { x, y } = alien;
    this.spawnExplosion(x, y, { radius: 16, color: 0xfff59d, duration: 160 });
    this.host.audio.play("hit");

    const hit = hitAlien(this.alienHealth.get(alien) ?? 1);
    if (hit.destroyed) {
      this.alienHealth.delete(alien);
      alien.destroy();
      this.score += hit.points;
      this.hud.setScore(this.score);
      this.maybeDropPowerUp(x, y);
      return;
    }

    this.alienHealth.set(alien, hit.health);
    // Flash white for a moment.
    alien.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.time.delayedCall(100, () => {
      if (alien.active) alien.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    });
  }

  // ---- Collisions ---------------------------------------------------------

  private checkCollisions() {
    const aliens = this.activeSprites(this.aliens);

    // Player bullets hit aliens: one bullet, one hit.
    for (const bullet of this.activeSprites(this.bullets)) {
      const target = aliens.find(
        (a) =>
          a.active &&
          Phaser.Math.Distance.Between(bullet.x, bullet.y, a.x, a.y) < BULLET_HIT_RADIUS,
      );
      if (!target) continue;
      this.bullets.killAndHide(bullet);
      this.damageAlien(target);
    }

    // Collect power-ups (reverse loop: we remove as we go).
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const powerUp = this.powerUps[i];
      if (!powerUp) continue;
      const { sprite } = powerUp;
      if (
        Phaser.Math.Distance.Between(this.player.x, this.player.y, sprite.x, sprite.y) <
        PICKUP_RADIUS
      ) {
        this.powerUps.splice(i, 1);
        sprite.destroy();
        this.activatePowerUp(powerUp.type);
      }
    }

    // Alien shots hit the player.
    for (const bullet of this.activeSprites(this.alienBullets)) {
      if (
        Phaser.Math.Distance.Between(this.player.x, this.player.y, bullet.x, bullet.y) >=
        PLAYER_HIT_RADIUS
      ) {
        continue;
      }
      this.alienBullets.killAndHide(bullet);
      if (this.shieldTimer > 0) {
        this.absorbShieldHit();
      } else {
        this.gameOver(this.player.x, this.player.y - 10);
        return;
      }
    }

    if (this.aliens.countActive() === 0 && !this.levelTransitionPending) {
      this.nextLevel();
    }
  }

  // ---- Power-ups ----------------------------------------------------------

  private maybeDropPowerUp(x: number, y: number) {
    const type = rollPowerup(this.level, this.time.now - this.lastPowerUpDrop, this.rng);
    if (!type) return;
    const sprite = this.add.sprite(x, y, POWERUP_TEXTURE[type]).setScale(0.6);
    this.powerUps.push({ sprite, type });
    this.lastPowerUpDrop = this.time.now;
  }

  private movePowerUps(dt: number) {
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const powerUp = this.powerUps[i];
      if (!powerUp) continue;
      powerUp.sprite.y += POWERUP_FALL_SPEED * dt;
      if (powerUp.sprite.y > GAME_HEIGHT) {
        powerUp.sprite.destroy();
        this.powerUps.splice(i, 1);
      }
    }
  }

  private clearPowerUps() {
    for (const p of this.powerUps) p.sprite.destroy();
    this.powerUps = [];
  }

  private activatePowerUp(type: PowerUpType) {
    this.host.audio.ding();
    this.host.haptics.tap();
    const duration = POWERUP_DURATION_MS[type];
    if (type === "rapidFire") this.rapidFireTimer = duration;
    else if (type === "doubleBullet") this.doubleBulletTimer = duration;
    else this.enableShield(duration);
  }

  private updatePowerUpTimers(delta: number) {
    this.rapidFireTimer = Math.max(0, this.rapidFireTimer - delta);
    this.doubleBulletTimer = Math.max(0, this.doubleBulletTimer - delta);
    if (this.shieldTimer > 0) {
      this.shieldTimer -= delta;
      if (this.shieldTimer <= 0) this.disableShield();
      else this.shieldVisual?.setPosition(this.player.x, this.player.y - 5);
    }
  }

  private enableShield(duration: number) {
    this.shieldTimer = duration;
    this.shieldVisual?.destroy();
    this.shieldVisual = this.add
      .circle(this.player.x, this.player.y - 5, 36, 0x80deea, 0.25)
      .setStrokeStyle(3, 0x26c6da, 0.9)
      .setDepth(10);
  }

  private disableShield() {
    this.shieldTimer = 0;
    this.shieldVisual?.destroy();
    this.shieldVisual = undefined;
  }

  private absorbShieldHit() {
    this.spawnExplosion(this.player.x, this.player.y - 10, {
      radius: 28,
      color: 0x80deea,
      duration: 220,
    });
    this.disableShield();
    this.host.audio.thud();
  }

  // ---- Waves and the end --------------------------------------------------

  private nextLevel() {
    if (this.levelTransitionPending) return;
    this.levelTransitionPending = true;
    this.level++;
    this.showWave();
    this.host.audio.play("score");
    this.hud.popup(`Wave ${this.level}!`, GAME_WIDTH / 2, GAME_HEIGHT / 2);

    // A short break: no shots in flight, no power-ups left over.
    this.alienFireEvent?.remove(false);
    this.alienFireEvent = undefined;
    this.disableShield();
    this.recycleAll(this.bullets);
    this.recycleAll(this.alienBullets);
    this.clearPowerUps();
    this.lastPowerUpDrop = this.time.now;
    this.aliens.clear(true, true);
    this.alienHealth.clear();
    this.alienDirection = 1;

    this.time.delayedCall(WAVE_BREAK_MS, () => {
      if (this.runEnded) return;
      this.createAlienFormation();
      this.levelTransitionPending = false;
      this.startAlienFireLoop();
    });
  }

  private gameOver(x: number, y: number) {
    if (this.runEnded) return;
    this.spawnExplosion(x, y, { radius: 50, color: 0xff7043, duration: 320 });
    this.disableShield();
    this.alienFireEvent?.remove(false);
    this.alienFireEvent = undefined;
    this.endRun(this.score);
  }

  // ---- Effects ------------------------------------------------------------

  private drawPlanetSurface() {
    this.add
      .graphics()
      .fillStyle(0x0f1b33, 1)
      .fillCircle(GAME_WIDTH / 2, GAME_HEIGHT + 220, 560)
      .fillStyle(0x1c2c52, 0.8)
      .fillCircle(GAME_WIDTH / 2, GAME_HEIGHT + 160, 520)
      .setDepth(-5);
    this.add
      .graphics()
      .fillStyle(0x4dd0e1, 0.35)
      .fillCircle(GAME_WIDTH / 2, PLANET_SURFACE_Y + 20, 200)
      .setDepth(-4);
  }

  private spawnExplosion(
    x: number,
    y: number,
    options: { radius?: number; duration?: number; color?: number } = {},
  ) {
    const { radius = 24, duration = 220, color = 0xffc107 } = options;
    const circle = this.add
      .circle(x, y, Math.max(radius * 0.3, 6), color, 0.9)
      .setDepth(900)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: circle,
      scale: radius / circle.radius,
      alpha: 0,
      duration,
      ease: "cubic.out",
      onComplete: () => circle.destroy(),
    });
  }

  private activeSprites(group: Phaser.GameObjects.Group): Phaser.GameObjects.Sprite[] {
    return group.getChildren().filter((c) => c.active) as Phaser.GameObjects.Sprite[];
  }
}
