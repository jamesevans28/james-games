import Phaser from "phaser";
import { dispatchGameOver } from "../../utils/gameEvents";
import { trackGameStart } from "../../utils/analytics";

const GAME_ID = "block-breaker";
const GAME_NAME = "Block Breaker";

const PADDLE_WIDTH = 120;
const PADDLE_HEIGHT = 20;
const PADDLE_Y = 900;

const BALL_RADIUS = 12;
const BALL_SPEED = 450;

const BRICK_ROWS = 6;
const BRICK_COLS = 8;
const BRICK_WIDTH = 60;
const BRICK_HEIGHT = 25;
const BRICK_GAP = 5;
const BRICKS_Y_OFFSET = 100;

export default class BlockBreakerScene extends Phaser.Scene {
  private paddle!: Phaser.GameObjects.Rectangle;
  private ball!: Phaser.GameObjects.Arc;
  private bricks!: Phaser.GameObjects.Group;
  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "BlockBreakerScene" });
  }

  create() {
    this.createPaddle();
    this.createBall();
    this.createBricks();
    this.createUI();

    this.physics.add.collider(this.ball, this.paddle, this.hitPaddle, undefined, this);
    this.physics.add.collider(this.ball, this.bricks, this.hitBrick, undefined, this);

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      this.paddle.x = Phaser.Math.Clamp(
        pointer.x,
        PADDLE_WIDTH / 2,
        this.scale.width - PADDLE_WIDTH / 2
      );
    });

    trackGameStart(GAME_ID, GAME_NAME);
  }

  update() {
    if (this.ball.y > this.scale.height) {
      this.gameOver();
    }
  }

  private createPaddle() {
    this.paddle = this.add.rectangle(
      this.scale.width / 2,
      PADDLE_Y,
      PADDLE_WIDTH,
      PADDLE_HEIGHT,
      0xffffff
    );
    this.physics.add.existing(this.paddle, true);
  }

  private createBall() {
    this.ball = this.add.circle(
      this.scale.width / 2,
      PADDLE_Y - PADDLE_HEIGHT,
      BALL_RADIUS,
      0xffffff
    );
    this.physics.add.existing(this.ball);
    const ballBody = this.ball.body as Phaser.Physics.Arcade.Body;
    ballBody.setCollideWorldBounds(true);
    ballBody.setBounce(1);
    ballBody.setVelocity(Phaser.Math.Between(-100, 100), -BALL_SPEED);
  }

  private createBricks() {
    this.bricks = this.add.group();
    const totalBricksWidth = BRICK_COLS * (BRICK_WIDTH + BRICK_GAP) - BRICK_GAP;
    const xOffset = (this.scale.width - totalBricksWidth) / 2;

    for (let i = 0; i < BRICK_ROWS; i++) {
      for (let j = 0; j < BRICK_COLS; j++) {
        const brickX = xOffset + j * (BRICK_WIDTH + BRICK_GAP) + BRICK_WIDTH / 2;
        const brickY = BRICKS_Y_OFFSET + i * (BRICK_HEIGHT + BRICK_GAP) + BRICK_HEIGHT / 2;
        const brick = this.add.rectangle(brickX, brickY, BRICK_WIDTH, BRICK_HEIGHT, 0x00ff00);
        this.physics.add.existing(brick, true);
        this.bricks.add(brick);
      }
    }
  }

  private createUI() {
    this.scoreText = this.add.text(20, 20, "Score: 0", {
      fontSize: "32px",
      color: "#fff",
    });
  }

  private hitPaddle(
    ball: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    paddle: Phaser.Types.Physics.Arcade.GameObjectWithBody
  ) {
    const ballBody = ball.body as Phaser.Physics.Arcade.Body;
    const paddleBody = paddle.body as Phaser.Physics.Arcade.Body;
    const diff = ballBody.x - paddleBody.x;
    const newVelX = diff * 10;
    ballBody.setVelocityX(newVelX);
  }

  private hitBrick(
    ball: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    brick: Phaser.Types.Physics.Arcade.GameObjectWithBody
  ) {
    brick.destroy();
    this.score += 10;
    this.scoreText.setText(`Score: ${this.score}`);

    if (this.bricks.countActive(true) === 0) {
      this.levelComplete();
    }
  }

  private levelComplete() {
    // For now, just restart
    this.createBricks();
    this.ball.setPosition(this.scale.width / 2, PADDLE_Y - PADDLE_HEIGHT);
    const ballBody = this.ball.body as Phaser.Physics.Arcade.Body;
    ballBody.setVelocity(Phaser.Math.Between(-100, 100), -BALL_SPEED);
  }

  private gameOver() {
    dispatchGameOver({ gameId: GAME_ID, score: this.score });
    this.scene.restart();
  }
}
