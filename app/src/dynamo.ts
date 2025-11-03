import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
// Minimal declaration to satisfy TypeScript without @types/node in this workspace
declare const process: any;

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-southeast-2";
const TABLE_NAME = process.env.TABLE_NAME || "games4james-gamescores";
const SCORE_GSI = process.env.SCORE_GSI_NAME || "GameScoresByScore";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

export async function putScore(args: { gameId: string; name: string; score: number }) {
  const now = new Date().toISOString();
  const item = {
    gameId: args.gameId,
    score: args.score,
    name: args.name,
    createdAt: now,
  };
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );
  return item;
}

export async function getTopScores(gameId: string, limit = 10) {
  // Query the GSI for the gameId, fetching a larger page to allow stable
  // secondary sorting by createdAt in application code (so equal scores
  // are ordered by createdAt ascending, i.e. most recent on bottom).
  const fetchLimit = Math.max(limit * 5, 100); // heuristic to fetch enough items
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: SCORE_GSI,
      KeyConditionExpression: "gameId = :g",
      ExpressionAttributeValues: { ":g": gameId },
      ScanIndexForward: false, // highest score first
      Limit: fetchLimit,
    })
  );

  const items = (result.Items || []) as Array<any>;

  // Sort: primary score desc, secondary createdAt asc (older first, newest last)
  items.sort((a, b) => {
    const sa = Number(a.score ?? 0);
    const sb = Number(b.score ?? 0);
    if (sb !== sa) return sb - sa; // score desc
    const ca = a.createdAt || "";
    const cb = b.createdAt || "";
    if (ca < cb) return -1;
    if (ca > cb) return 1;
    return 0;
  });

  return items.slice(0, limit).map((i: any) => ({
    name: i.name,
    score: i.score,
    createdAt: i.createdAt,
  }));
}
