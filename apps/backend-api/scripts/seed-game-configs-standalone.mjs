import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const { AWS_REGION, COGNITO_REGION, TABLE_GAME_CONFIG } = process.env;

const region = COGNITO_REGION || AWS_REGION || "ap-southeast-2";
const tableName = TABLE_GAME_CONFIG || "games4james-game-config";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

// Minimal seed data copied from apps/player-web/src/games/index.ts (metadata only)
const games = [
  {
    gameId: "reflex-ring",
    title: "Reflex Ring",
    description: "Tap precisely as the arrow hits the highlighted segment. Speeds up over time.",
    objective: "Tap the screen exactly when the rotating arrow overlaps with the colored segment.",
    controls: "Tap anywhere on the screen.",
    thumbnail: "/assets/reflex-ring/thumbnail.svg",
    xpMultiplier: 2.92,
    createdAt: "2025-09-15T00:00:00.000Z",
    updatedAt: "2025-11-26T00:00:00.000Z",
    betaOnly: false,
  },
  {
    gameId: "snapadile",
    title: "Snapadile",
    description: "Tap the crocs before they reach your raft. More and faster crocs over time.",
    objective: "Prevent crocodiles from reaching your raft by tapping them.",
    controls: "Tap on the crocodiles to scare them away.",
    thumbnail: "/assets/snapadile/thumbnail.svg",
    xpMultiplier: 1.93,
    createdAt: "2025-09-16T00:00:00.000Z",
    updatedAt: "2025-11-25T00:00:00.000Z",
    betaOnly: false,
  },
  {
    gameId: "car-crash",
    title: "Car Crash",
    description:
      "Switch lanes to dodge incoming cars. Step-based movement with growing difficulty.",
    objective: "Dodge incoming traffic by switching lanes.",
    controls: "Tap left or right to switch lanes.",
    thumbnail: "/assets/car-crash/thumbnail.svg",
    xpMultiplier: 2.47,
    createdAt: "2025-09-17T00:00:00.000Z",
    updatedAt: "2025-11-25T00:00:00.000Z",
    betaOnly: false,
  },
  {
    gameId: "fill-the-cup",
    title: "Fill the Cup",
    description:
      "Hold to pour water and fill each glass to the highlighted band. Smaller targets over time.",
    objective: "Fill the glass to the target line without overflowing or underfilling.",
    controls: "Hold screen to pour, release to stop.",
    thumbnail: "/assets/fill-the-cup/thumbnail.svg",
    xpMultiplier: 3.0,
    createdAt: "2025-11-01T00:00:00.000Z",
    updatedAt: "2025-11-25T00:00:00.000Z",
    betaOnly: false,
  },
  {
    gameId: "flash-bash",
    title: "Flash Bash",
    description:
      "Watch the sequence of colored shapes, then mimic them before time runs out. Sequences get longer!",
    objective: "Memorize and repeat the sequence of flashing colors.",
    controls: "Tap the colored buttons in the correct order.",
    thumbnail: "/assets/flash-bash/thumbnail.svg",
    xpMultiplier: 4.13,
    createdAt: "2025-11-04T00:00:00.000Z",
    updatedAt: "2025-11-25T00:00:00.000Z",
    betaOnly: false,
  },
  {
    gameId: "ho-ho-home-delivery",
    title: "Ho Ho Home Delivery",
    description:
      "Drop presents into chimneys from Santa's sleigh. Nail the landing, avoid misses. 3 lives!",
    objective: "Deliver presents into the chimneys as you fly over houses.",
    controls: "Tap to drop a present.",
    thumbnail: "/assets/ho-ho-home-delivery/thumbnail.svg",
    xpMultiplier: 3.78,
    createdAt: "2025-11-05T00:00:00.000Z",
    updatedAt: "2025-11-25T00:00:00.000Z",
    betaOnly: false,
  },
  {
    gameId: "ready-steady-shoot",
    title: "Ready Steady Shoot",
    description:
      "Hold to pick angle, hold to pick power, then release to shoot. Swish for 2 points! 3 lives.",
    objective: "Shoot the basketball into the hoop by adjusting angle and power.",
    controls: "Hold to aim, release to set power and shoot.",
    thumbnail: "/assets/ready-steady-shoot/thumbnail.svg",
    xpMultiplier: 25.0,
    createdAt: "2025-11-05T00:00:00.000Z",
    updatedAt: "2025-11-25T00:00:00.000Z",
    betaOnly: false,
  },
  {
    gameId: "paddle-pop",
    title: "Paddle Pop",
    description: "Deflect the marble, collect power-ups, hit bonus discs, avoid falling obstacles.",
    objective: "Keep the ball in the air and hit targets.",
    controls: "Drag the paddle left and right.",
    thumbnail: "/assets/paddle-pop/thumbnail.svg",
    xpMultiplier: 5.13,
    createdAt: "2025-11-05T00:00:00.000Z",
    updatedAt: "2025-11-25T00:00:00.000Z",
    betaOnly: false,
  },
  {
    gameId: "word-rush",
    title: "Word Rush with Tom",
    description: "Guess words and phrases with your selected letters. 2-minute timer per level!",
    objective: "Solve the word puzzle before time runs out.",
    controls: "Tap letters to guess the word.",
    thumbnail: "/assets/word-rush/thumbnail.svg",
    xpMultiplier: 1.42,
    createdAt: "2025-11-05T00:00:00.000Z",
    updatedAt: "2025-11-25T00:00:00.000Z",
    betaOnly: false,
  },
  {
    gameId: "serpento",
    title: "Serpento",
    description:
      "Classic snake game. Turn left/right to collect food, avoid walls and yourself. Gets faster as you grow!",
    objective: "Eat food to grow longer, avoid hitting walls or yourself.",
    controls: "Tap left or right side of screen to turn.",
    thumbnail: "/assets/serpento/thumbnail.svg",
    xpMultiplier: 18.5,
    createdAt: "2025-11-17T00:00:00.000Z",
    updatedAt: "2025-11-25T00:00:00.000Z",
    betaOnly: false,
  },
  {
    gameId: "blocker",
    title: "Blocker",
    description:
      "Drag puzzle pieces into a 8x8 board, clear full lines, trigger power blocks, and chase combos before you run out of moves.",
    objective: "Place blocks to form full rows or columns to clear them.",
    controls: "Drag and drop blocks onto the grid.",
    thumbnail: "/assets/blocker/thumbnail.svg",
    xpMultiplier: 0.63,
    createdAt: "2025-11-24T00:00:00.000Z",
    updatedAt: "2025-11-25T00:00:00.000Z",
    betaOnly: false,
  },
  {
    gameId: "hoop-city",
    title: "Hoop City",
    description:
      "Tap to keep the ball afloat while threading every vertical hoop as the city scrolls by.",
    objective: "Float the ball through each hoop without touching the skyline or missing a ring.",
    controls: "Tap anywhere or press space to bounce upward.",
    thumbnail: "/assets/hoop-city/thumbnail.svg",
    xpMultiplier: 2.15,
    createdAt: "2025-11-28T00:00:00.000Z",
    updatedAt: "2025-12-02T00:00:00.000Z",
    betaOnly: false,
  },
  {
    gameId: "cosmic-clash",
    title: "Cosmic Clash",
    description:
      "Space Invaders-style shooter. Auto-fire at descending aliens, collect power-ups, survive waves!",
    objective: "Destroy waves of alien invaders.",
    controls: "Drag to move ship, it shoots automatically.",
    thumbnail: "/assets/cosmic-clash/thumbnail.svg",
    xpMultiplier: 0.5,
    createdAt: "2025-11-21T00:00:00.000Z",
    updatedAt: "2025-11-25T00:00:00.000Z",
    betaOnly: false,
  },
  {
    gameId: "block-breaker",
    title: "Block Breaker",
    description: "A classic brick-breaking game. Clear all the bricks to win.",
    objective: "Break all the bricks with the ball.",
    controls: "Move the paddle with the mouse.",
    thumbnail: "/assets/block-breaker/thumbnail.svg",
    xpMultiplier: 1.5,
    createdAt: "2025-12-01T00:00:00.000Z",
    updatedAt: "2025-12-01T00:00:00.000Z",
    betaOnly: true,
  },
];

async function run() {
  console.log("Seeding game configs into", tableName, "in region", region);

  for (const game of games) {
    const now = new Date().toISOString();
    const item = {
      ...game,
      metadata: null,
      createdAt: game.createdAt || now,
      updatedAt: game.updatedAt || now,
    };

    console.log("Upserting", item.gameId);
    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
      })
    );
  }

  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
