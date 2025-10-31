import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
// Minimal declaration to satisfy TypeScript without @types/node in this workspace
declare const process: any;

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-southeast-2";
const TABLE_NAME = process.env.TABLE_NAME || "games4james-scores";

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
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "gameId = :g",
      ExpressionAttributeValues: { ":g": gameId },
      ScanIndexForward: false, // highest score first
      Limit: limit,
    })
  );
  return (res.Items || []).map((i: any) => ({
    name: i.name,
    score: i.score,
    createdAt: i.createdAt,
  }));
}
