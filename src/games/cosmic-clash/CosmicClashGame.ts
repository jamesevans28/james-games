import Phaser from "phaser";
import { dispatchGameOver } from "../../utils/gameEvents";

const GAME_WIDTH = 540;
const GAME_HEIGHT = 960;
const PLANET_SURFACE_Y = GAME_HEIGHT - 70;
const PLAYER_BULLET_SPEED = -500;
const ALIEN_BULLET_SPEED = 140;
const TAP_NUDGE_DISTANCE = 45;
const HOLD_MOVE_SPEED = 320; // px per second
const TAP_THRESHOLD_MS = 180;

type PowerUpType = "rapidFire" | "doubleBullet" | "shield";

interface PowerUp {
  sprite: Phaser.GameObjects.Sprite;
  type: PowerUpType;
}

export default class CosmicClashGame extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private bullets!: Phaser.GameObjects.Group;
  private alienBullets!: Phaser.GameObjects.Group;
  private aliens!: Phaser.GameObjects.Group;
  private powerUps!: PowerUp[];
  private stars!: Phaser.GameObjects.TileSprite;
  
  private score = 0;
  private level = 1;
  private alienSpeed = 0;
  private alienDirection = 1;
  private lastFired = 0;
  private fireRate = 550;
  private doubleBulletActive = false;
  private doubleBulletTimer = 0;
  private rapidFireActive = false;
  private rapidFireTimer = 0;
  private shieldActive = false;
  private shieldTimer = 0;
  private shieldVisual?: Phaser.GameObjects.Arc;
  private lastPowerUpSpawn = 0;
  private pointerHoldDirection: -1 | 0 | 1 = 0;
  private pointerHoldStart = 0;
  private planetGraphic?: Phaser.GameObjects.Graphics;
  
  private scoreText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private gameOverText: Phaser.GameObjects.Text | null = null;
  private isGameOver = false;
  private levelTransitionPending = false;
  private alienFireEvent?: Phaser.Time.TimerEvent;
  private audioContext?: AudioContext;

  constructor() {
    super({ key: "CosmicClashGame" });
  }

  preload() {
    // Load SVG assets
    this.load.svg("player", "/assets/cosmic-clash/player.svg", { scale: 1 });
    this.load.svg("alien", "/assets/cosmic-clash/alien.svg", { scale: 1 });
    this.load.svg("alien-strong", "/assets/cosmic-clash/alien-strong.svg", { scale: 1 });
    this.load.svg("bullet", "/assets/cosmic-clash/bullet.svg", { scale: 1 });
    this.load.svg("star", "/assets/cosmic-clash/star.svg", { scale: 1 });
    this.load.svg("powerup-rapid", "/assets/cosmic-clash/powerup-rapid.svg", { scale: 1 });
    this.load.svg("powerup-double", "/assets/cosmic-clash/powerup-double.svg", { scale: 1 });
    this.load.svg("powerup-shield", "/assets/cosmic-clash/powerup-shield.svg", { scale: 1 });
  }

  create() {
    // Black background
    this.cameras.main.setBackgroundColor("#000000");
    
    // Scrolling stars background
    this.stars = this.add.tileSprite(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      "star"
    );
    this.stars.setTileScale(0.5, 0.5);
    
    // Player ship
    this.player = this.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT - 80, "player");
    this.player.setScale(0.8);
  this.drawPlanetSurface();

    this.alienSpeed = this.getAlienSpeedForLevel();
    
    // Groups
    this.bullets = this.add.group({
      maxSize: 50,
      runChildUpdate: false,
    });
    
    this.alienBullets = this.add.group({
      maxSize: 20,
      runChildUpdate: false,
    });
    
    this.aliens = this.add.group();
    this.powerUps = [];
    
    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    
  // Touch/pointer input for mobile
  this.input.on("pointerdown", this.handlePointerDownControl, this);
  this.input.on("pointerup", this.handlePointerUpControl, this);
  this.input.on("pointerupoutside", this.handlePointerUpControl, this);
    
    // UI
    this.scoreText = this.add.text(16, 16, "Score: 0", {
      fontSize: "20px",
      color: "#ffffff",
      fontFamily: "Arial",
    });
    
    this.levelText = this.add.text(GAME_WIDTH - 16, 16, "Level: 1", {
      fontSize: "20px",
      color: "#ffffff",
      fontFamily: "Arial",
      align: "right",
    });
    this.levelText.setOrigin(1, 0);
    
    // Create initial alien formation
    this.createAlienFormation();
    
    // Start auto-firing
    this.time.addEvent({
      delay: 100,
      callback: this.autoFire,
      callbackScope: this,
      loop: true,
    });

    this.startAlienFireLoop();
  }

  private handlePointerDownControl(pointer: Phaser.Input.Pointer) {
    if (this.isGameOver) return;
    const direction = pointer.x < GAME_WIDTH / 2 ? -1 : 1;
  this.pointerHoldDirection = direction;
    this.pointerHoldStart = this.time.now;
  }

  private handlePointerUpControl(pointer: Phaser.Input.Pointer) {
    if (this.isGameOver) return;
    const direction = pointer.x < GAME_WIDTH / 2 ? -1 : 1;
    const elapsed = this.time.now - this.pointerHoldStart;
    if (elapsed <= TAP_THRESHOLD_MS) {
      this.nudgePlayer(direction);
    }
    this.pointerHoldDirection = 0;
  }

  private nudgePlayer(direction: -1 | 1) {
    const targetX = Phaser.Math.Clamp(
      this.player.x + direction * TAP_NUDGE_DISTANCE,
      40,
      GAME_WIDTH - 40
    );
    this.player.x = targetX;
  }

  private autoFire() {
    if (this.isGameOver) return;
    
    const currentTime = this.time.now;
    const currentFireRate = this.rapidFireActive ? this.fireRate / 2 : this.fireRate;
    
    if (currentTime > this.lastFired + currentFireRate) {
      this.fireBullet();
      this.lastFired = currentTime;
    }
  }

  private fireBullet() {
    if (this.doubleBulletActive) {
      // Fire two bullets
      const bullet1 = this.add.sprite(this.player.x - 15, this.player.y - 20, "bullet");
      const bullet2 = this.add.sprite(this.player.x + 15, this.player.y - 20, "bullet");
      
      bullet1.setScale(0.6);
      bullet2.setScale(0.6);
  bullet1.setData("velocity", PLAYER_BULLET_SPEED);
  bullet2.setData("velocity", PLAYER_BULLET_SPEED);
      
      this.bullets.add(bullet1);
      this.bullets.add(bullet2);
    } else {
      // Fire single bullet
      const bullet = this.add.sprite(this.player.x, this.player.y - 20, "bullet");
      bullet.setScale(0.6);
  bullet.setData("velocity", PLAYER_BULLET_SPEED);
      this.bullets.add(bullet);
    }
    
    // Removed shoot sound
  }

  private getAlienFireDelay(): number {
    // Level 1: no firing (handled by if check)
    // Level 2: fire every 8 seconds
    // Level 3: fire every 6 seconds
    // Level 4: fire every 4 seconds
    // Level 5+: fire every 3 seconds
    if (this.level <= 2) return 8000;
    if (this.level === 3) return 6000;
    if (this.level === 4) return 4000;
    return 3000;
  }

  private getAlienSpeedForLevel(level = this.level): number {
    const base = 0.26;
    const incremental = Math.min(level - 1, 6) * 0.052; // ~4% faster growth
    return base + incremental;
  }

  private startAlienFireLoop() {
    if (this.alienFireEvent) {
      this.alienFireEvent.remove(false);
      this.alienFireEvent = undefined;
    }
    this.disableShield();

    if (this.level < 2 || this.isGameOver) {
      return;
    }

    this.alienFireEvent = this.time.addEvent({
      delay: this.getAlienFireDelay(),
      callback: this.alienFire,
      callbackScope: this,
      loop: true,
    });
  }

  private alienFire() {
    if (this.isGameOver || this.aliens.countActive() === 0) return;
    
    // Pick a random alien to fire
    const activeAliens = this.aliens.children.entries.filter(a => a.active);
    if (activeAliens.length === 0) return;
    
    const randomAlien = Phaser.Utils.Array.GetRandom(activeAliens) as Phaser.GameObjects.Sprite;
    
    // Create alien bullet
    const bullet = this.add.sprite(randomAlien.x, randomAlien.y + 20, "bullet");
    bullet.setScale(0.6);
    bullet.setTint(0xff0000); // Red tint for enemy bullets
  bullet.setData("velocity", ALIEN_BULLET_SPEED);
    this.alienBullets.add(bullet);
  }

  private drawPlanetSurface() {
    if (this.planetGraphic) {
      this.planetGraphic.destroy();
    }
    const graphics = this.add.graphics();
    graphics.fillStyle(0x0f1b33, 1);
    graphics.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT + 220, 560);
    graphics.fillStyle(0x1c2c52, 0.8);
    graphics.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT + 160, 520);
    graphics.setDepth(-5);
    const horizonGlow = this.add.graphics();
    horizonGlow.fillStyle(0x4dd0e1, 0.35);
    horizonGlow.fillCircle(GAME_WIDTH / 2, PLANET_SURFACE_Y + 20, 200);
    horizonGlow.setDepth(-4);
    this.planetGraphic = graphics;
  }

  private createAlienFormation() {
    const rows = 4;
    const cols = 8;
    const spacing = 60;
    const startX = (GAME_WIDTH - (cols - 1) * spacing) / 2;
    const startY = 100;
    
    const strongRowCount = this.level >= 4 ? 2 : this.level === 3 ? 1 : 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Determine if this should be a strong alien based on level
        const isStrong = row < strongRowCount;
        const texture = isStrong ? "alien-strong" : "alien";
        const health = isStrong ? (this.level >= 6 ? 3 : 2) : 1;
        
        const alien = this.aliens.create(
          startX + col * spacing,
          startY + row * spacing,
          texture
        );
        alien.setScale(0.7);
        alien.setData("row", row);
        alien.setData("col", col);
        alien.setData("health", health);
        alien.setData("maxHealth", health);
      }
    }
  }

  private moveAliens(delta: number) {
    const deltaFactor = delta / (1000 / 60);
    const moveAmount = this.alienSpeed * deltaFactor;
    let shouldMoveDown = false;

    this.aliens.children.entries.forEach((alien) => {
      const sprite = alien as Phaser.GameObjects.Sprite;
      const nextX = sprite.x + moveAmount * this.alienDirection;
      if (nextX <= 40 || nextX >= GAME_WIDTH - 40) {
        shouldMoveDown = true;
      }
    });

    if (shouldMoveDown) {
      this.alienDirection *= -1;
      this.aliens.children.entries.forEach((alien) => {
        const sprite = alien as Phaser.GameObjects.Sprite;
        sprite.y += 18;
        sprite.x = Phaser.Math.Clamp(
          sprite.x + moveAmount * this.alienDirection,
          40,
          GAME_WIDTH - 40
        );

        if (sprite.y >= PLANET_SURFACE_Y) {
          this.triggerGameOver(sprite.x, PLANET_SURFACE_Y - 10);
        }
      });
    } else {
      this.aliens.children.entries.forEach((alien) => {
        const sprite = alien as Phaser.GameObjects.Sprite;
        sprite.x = Phaser.Math.Clamp(
          sprite.x + moveAmount * this.alienDirection,
          40,
          GAME_WIDTH - 40
        );
      });
    }
  }

  private checkCollisions() {
    // Bullets hit aliens
    this.bullets.children.entries.forEach((bullet) => {
      const bulletSprite = bullet as Phaser.GameObjects.Sprite;
      if (!bulletSprite.active) return;
      
      this.aliens.children.entries.forEach((alien) => {
        const alienSprite = alien as Phaser.GameObjects.Sprite;
        if (!alienSprite.active) return;
        
        const distance = Phaser.Math.Distance.Between(
          bulletSprite.x,
          bulletSprite.y,
          alienSprite.x,
          alienSprite.y
        );
        
        if (distance < 30) {
          this.bullets.remove(bulletSprite, true, true);
          this.spawnExplosion(alienSprite.x, alienSprite.y, {
            radius: 16,
            color: 0xfff59d,
            duration: 160,
          });
          
          // Reduce alien health
          let health = alienSprite.getData("health") || 1;
          health--;
          alienSprite.setData("health", health);
          
          this.playHitSound();
          
          // Visual feedback - flash white
          alienSprite.setTint(0xffffff);
          this.time.delayedCall(100, () => {
            if (alienSprite.active) {
              alienSprite.clearTint();
            }
          });
          
          // Destroy if health reaches 0
          if (health <= 0) {
            alienSprite.destroy();
            this.score += 10;
            this.scoreText.setText(`Score: ${this.score}`);
            this.maybeSpawnPowerUp(alienSprite.x, alienSprite.y);
          }
        }
      });
    });
    
    // Check power-up collection
    this.powerUps = this.powerUps.filter((powerUp) => {
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        powerUp.sprite.x,
        powerUp.sprite.y
      );
      
      if (distance < 40) {
        this.activatePowerUp(powerUp.type);
        powerUp.sprite.destroy();
        return false;
      }
      return true;
    });
    
    // Check alien bullets hitting player
    this.alienBullets.children.entries.forEach((bullet) => {
      const bulletSprite = bullet as Phaser.GameObjects.Sprite;
      if (!bulletSprite.active) return;
      
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        bulletSprite.x,
        bulletSprite.y
      );
      
      if (distance < 35) {
        this.alienBullets.remove(bulletSprite, true, true);
        if (this.shieldActive) {
          this.absorbShieldHit();
        } else {
          this.triggerGameOver(this.player.x, this.player.y - 10);
        }
      }
    });
    
    // Check if all aliens destroyed
    if (this.aliens.countActive() === 0 && !this.levelTransitionPending) {
      this.nextLevel();
    }
  }

  private maybeSpawnPowerUp(x: number, y: number) {
    if (this.level < 2) return;
    const available = this.getAvailablePowerUpTypes();
    if (!available.length) return;

    const COOLDOWN = 9000;
    if (this.time.now - this.lastPowerUpSpawn < COOLDOWN) return;

    const SPAWN_CHANCE = 0.35;
    if (Math.random() > SPAWN_CHANCE) return;

    const type = Phaser.Utils.Array.GetRandom(available);
    this.spawnPowerUp(type, x, y);
    this.lastPowerUpSpawn = this.time.now;
  }

  private getAvailablePowerUpTypes(): PowerUpType[] {
    const types: PowerUpType[] = [];
    if (this.level >= 2) types.push("doubleBullet");
    if (this.level >= 3) types.push("rapidFire");
    if (this.level >= 4) types.push("shield");
    return types;
  }

  private spawnPowerUp(type: PowerUpType, x: number, y: number) {
    const texture =
      type === "rapidFire"
        ? "powerup-rapid"
        : type === "doubleBullet"
        ? "powerup-double"
        : "powerup-shield";
    const sprite = this.add.sprite(x, y, texture);
    sprite.setScale(0.6);
    this.powerUps.push({ sprite, type });
  }

  private activatePowerUp(type: PowerUpType) {
    this.playPowerUpSound();
    if (type === "rapidFire") {
      this.rapidFireActive = true;
      this.rapidFireTimer = 8000;
    } else if (type === "doubleBullet") {
      this.doubleBulletActive = true;
      this.doubleBulletTimer = 8000;
    } else if (type === "shield") {
      this.enableShield();
    }
  }

  private enableShield() {
    this.shieldActive = true;
    this.shieldTimer = 7000;
    if (this.shieldVisual) {
      this.shieldVisual.destroy();
    }
    this.shieldVisual = this.add.circle(this.player.x, this.player.y - 5, 36, 0x80deea, 0.25);
    this.shieldVisual.setStrokeStyle(3, 0x26c6da, 0.9);
    this.shieldVisual.setDepth(10);
  }

  private disableShield() {
    this.shieldActive = false;
    if (this.shieldVisual) {
      this.shieldVisual.destroy();
      this.shieldVisual = undefined;
    }
  }

  private absorbShieldHit() {
    this.spawnExplosion(this.player.x, this.player.y - 10, {
      radius: 28,
      color: 0x80deea,
      duration: 220,
    });
    this.disableShield();
    this.playPowerUpSound();
  }

  private updateShield(delta: number) {
    if (!this.shieldActive || !this.shieldVisual) return;
    this.shieldTimer -= delta;
    this.shieldVisual.x = this.player.x;
    this.shieldVisual.y = this.player.y - 5;
    if (this.shieldTimer <= 0) {
      this.disableShield();
    }
  }

  private spawnExplosion(
    x: number,
    y: number,
    options: { radius?: number; duration?: number; color?: number } = {}
  ) {
    const { radius = 24, duration = 220, color = 0xffc107 } = options;
    const circle = this.add.circle(x, y, Math.max(radius * 0.3, 6), color, 0.9);
    circle.setDepth(900);
    circle.setBlendMode(Phaser.BlendModes.ADD);
    const targetScale = radius / circle.radius;
    this.tweens.add({
      targets: circle,
      scale: targetScale,
      alpha: 0,
      duration,
      ease: "cubic.out",
      onComplete: () => circle.destroy(),
    });
  }

  private nextLevel() {
    if (this.levelTransitionPending) {
      return;
    }

    this.levelTransitionPending = true;
    this.level++;
    this.alienSpeed = this.getAlienSpeedForLevel();
    this.levelText.setText(`Level: ${this.level}`);
    
    // Stop alien firing during transition
    if (this.alienFireEvent) {
      this.alienFireEvent.remove(false);
      this.alienFireEvent = undefined;
    }
    
    this.disableShield();
    
    // Clear bullets, alien bullets and power-ups
    this.bullets.clear(true, true);
    this.alienBullets.clear(true, true);
    this.powerUps.forEach((p) => p.sprite.destroy());
    this.powerUps = [];
    this.lastPowerUpSpawn = this.time.now;
    
    // Clear existing aliens
    this.aliens.clear(true, true);
    
    // Reset alien direction
    this.alienDirection = 1;
    
    // Create new formation
    this.time.delayedCall(1000, () => {
      this.createAlienFormation();
      this.levelTransitionPending = false;
      this.startAlienFireLoop();
    });
  }

  private triggerGameOver(explosionX?: number, explosionY?: number) {
    if (this.isGameOver) return;
    this.isGameOver = true;
    if (explosionX !== undefined && explosionY !== undefined) {
      this.spawnExplosion(explosionX, explosionY, { radius: 50, color: 0xff7043, duration: 320 });
    } else {
      this.spawnExplosion(this.player.x, this.player.y, { radius: 50, color: 0xff7043, duration: 320 });
    }
    this.disableShield();
    if (this.alienFireEvent) {
      this.alienFireEvent.remove(false);
      this.alienFireEvent = undefined;
    }
    
    this.gameOverText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "GAME OVER", {
      fontSize: "48px",
      color: "#ff0000",
      fontFamily: "Arial",
      fontStyle: "bold",
    });
    this.gameOverText.setOrigin(0.5);
    
    this.time.delayedCall(1000, () => {
      dispatchGameOver({ gameId: "cosmic-clash", score: this.score, ts: Date.now() });
    });
  }

  private getAudioContext(): AudioContext | null {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return null;

    if (!this.audioContext) {
      try {
        this.audioContext = new AudioContextCtor();
      } catch (error) {
        return null;
      }
    }

    if (this.audioContext.state === "suspended") {
      this.audioContext.resume().catch(() => {});
    }

    return this.audioContext;
  }

  private playHitSound() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.value = 150;
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  private playPowerUpSound() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.2);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  update(_time: number, delta: number) {
    if (this.isGameOver) return;
    const deltaSeconds = delta / 1000;
    
    // Scroll stars
    this.stars.tilePositionY -= 1;
    
    // Keyboard controls
    if (this.cursors.left.isDown) {
      this.player.x = Math.max(40, this.player.x - HOLD_MOVE_SPEED * deltaSeconds);
    } else if (this.cursors.right.isDown) {
      this.player.x = Math.min(GAME_WIDTH - 40, this.player.x + HOLD_MOVE_SPEED * deltaSeconds);
    }
    
    if (this.pointerHoldDirection !== 0) {
      this.player.x = Phaser.Math.Clamp(
        this.player.x + this.pointerHoldDirection * HOLD_MOVE_SPEED * deltaSeconds,
        40,
        GAME_WIDTH - 40
      );
    }
    
  // Move aliens
    this.moveAliens(delta);
    
    // Move power-ups down
    this.powerUps.forEach((powerUp) => {
      powerUp.sprite.y += 1.5;
      
      // Remove if off screen
      if (powerUp.sprite.y > GAME_HEIGHT) {
        powerUp.sprite.destroy();
      }
    });
    this.powerUps = this.powerUps.filter((p) => p.sprite.y <= GAME_HEIGHT);
    
    // Move and cleanup bullets
    this.bullets.children.entries.forEach((bullet) => {
      const sprite = bullet as Phaser.GameObjects.Sprite;
      const velocity = sprite.getData("velocity") || 0;
      sprite.y += velocity * (delta / 1000);
      
      // Remove if off screen
      if (sprite.y < -10) {
        this.bullets.remove(sprite, true, true);
      }
    });
    
    // Move and cleanup alien bullets
    this.alienBullets.children.entries.forEach((bullet) => {
      const sprite = bullet as Phaser.GameObjects.Sprite;
      const velocity = sprite.getData("velocity") || 0;
      sprite.y += velocity * (delta / 1000);
      
      // Remove if off screen
      if (sprite.y > GAME_HEIGHT + 10) {
        this.alienBullets.remove(sprite, true, true);
      }
    });
    
    // Update power-up timers
    if (this.rapidFireActive) {
      this.rapidFireTimer -= delta;
      if (this.rapidFireTimer <= 0) {
        this.rapidFireActive = false;
      }
    }
    
    if (this.doubleBulletActive) {
      this.doubleBulletTimer -= delta;
      if (this.doubleBulletTimer <= 0) {
        this.doubleBulletActive = false;
      }
    }
    
    this.updateShield(delta);
    
    // Check collisions
    this.checkCollisions();
  }
}
