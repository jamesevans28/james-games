import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { Buffer } from "node:buffer";
import { dynamoClient } from "../config/aws.js";
import { config } from "../config/index.js";

const ddb = DynamoDBDocumentClient.from(dynamoClient);

export type GameConfigRecord = {
  gameId: string;
  title: string;
  description?: string;
  objective?: string;
  controls?: string;
  thumbnail?: string;
  xpMultiplier?: number;
  betaOnly?: boolean;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, any> | null;
};

const allowedFields: Array<keyof GameConfigRecord> = [
  "title",
  "description",
  "objective",
  "controls",
  "thumbnail",
  "xpMultiplier",
  "betaOnly",
  "metadata",
];

function normalize(item?: Record<string, any> | null): GameConfigRecord | null {
  if (!item) return null;
  return {
    gameId: item.gameId,
    title: item.title,
    description: item.description,
    objective: item.objective,
    controls: item.controls,
    thumbnail: item.thumbnail,
    xpMultiplier: item.xpMultiplier !== undefined ? Number(item.xpMultiplier) : undefined,
    betaOnly: Boolean(item.betaOnly),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    metadata: item.metadata ?? null,
  };
}

function encodeCursor(key?: Record<string, any>) {
  if (!key) return undefined;
  return Buffer.from(JSON.stringify(key)).toString("base64url");
}

function decodeCursor(cursor?: string) {
  if (!cursor) return undefined;
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
}

export async function listGameConfigs(opts: { limit?: number; cursor?: string }) {
  const limit = Math.min(Math.max(Number(opts.limit) || 20, 5), 100);
  const resp = await ddb.send(
    new ScanCommand({
      TableName: config.tables.gameConfigs,
      Limit: limit,
      ExclusiveStartKey: decodeCursor(opts.cursor),
    })
  );
  return {
    items: (resp.Items || [])
      .map((item) => normalize(item as any))
      .filter(Boolean) as GameConfigRecord[],
    nextCursor: encodeCursor(resp.LastEvaluatedKey as any),
  };
}

export async function getGameConfig(gameId: string) {
  const resp = await ddb.send(
    new GetCommand({
      TableName: config.tables.gameConfigs,
      Key: { gameId },
    })
  );
  return normalize(resp.Item as any);
}

export async function createGameConfig(input: GameConfigRecord) {
  if (!input.gameId || !input.title) throw new Error("gameId_and_title_required");
  const now = new Date().toISOString();
  const item: Record<string, any> = {
    gameId: input.gameId,
    title: input.title,
    description: input.description ?? null,
    objective: input.objective ?? null,
    controls: input.controls ?? null,
    thumbnail: input.thumbnail ?? null,
    xpMultiplier: input.xpMultiplier ?? 1,
    betaOnly: Boolean(input.betaOnly),
    metadata: input.metadata ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await ddb.send(
    new PutCommand({
      TableName: config.tables.gameConfigs,
      Item: item,
      ConditionExpression: "attribute_not_exists(gameId)",
    })
  );
  return normalize(item) as GameConfigRecord;
}

export async function updateGameConfig(gameId: string, patch: Partial<GameConfigRecord>) {
  const fields = allowedFields.filter((field) => patch[field] !== undefined);
  if (!fields.length) throw new Error("no_fields_to_update");

  const sets = ["updatedAt = :u"];
  const values: Record<string, any> = { ":u": new Date().toISOString() };
  const names: Record<string, string> = {};

  fields.forEach((field, idx) => {
    const token = `#f${idx}`;
    sets.push(`${token} = :v${idx}`);
    names[token] = field;
    if (field === "betaOnly") {
      values[`:v${idx}`] = Boolean(patch[field]);
    } else {
      values[`:v${idx}`] = patch[field as keyof GameConfigRecord];
    }
  });

  await ddb.send(
    new UpdateCommand({
      TableName: config.tables.gameConfigs,
      Key: { gameId },
      UpdateExpression: "SET " + sets.join(", "),
      ExpressionAttributeValues: values,
      ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
      ConditionExpression: "attribute_exists(gameId)",
    })
  );

  return (await getGameConfig(gameId)) as GameConfigRecord;
}
