// DynamoDB data access layer (scores & users)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "../config/aws.js";
import { config } from "../config/index.js";

const ddb = DynamoDBDocumentClient.from(dynamoClient);

// Scores
export async function putScore(args: {
  gameId: string;
  name: string;
  score: number;
  emailProvided: boolean;
}) {
  const now = new Date().toISOString();
  const item = {
    gameId: args.gameId,
    score: args.score,
    name: args.name,
    emailProvided: args.emailProvided,
    createdAt: now,
  };
  await ddb.send(new PutCommand({ TableName: config.tables.scores, Item: item }));
  return item;
}

export async function getTopScores(gameId: string, limit = 10) {
  const fetchLimit = Math.max(limit * 5, 100);
  const result = await ddb.send(
    new QueryCommand({
      TableName: config.tables.scores,
      IndexName: config.tables.scoreGsi,
      KeyConditionExpression: "gameId = :g",
      ExpressionAttributeValues: { ":g": gameId },
      ScanIndexForward: false,
      Limit: fetchLimit,
    })
  );
  const items = (result.Items || []) as Array<any>;
  items.sort((a, b) => {
    const sa = Number(a.score ?? 0);
    const sb = Number(b.score ?? 0);
    if (sb !== sa) return sb - sa;
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
    emailProvided: i.emailProvided,
  }));
}

// Users
export async function putUser(args: {
  userId: string;
  screenName: string;
  emailProvided: boolean;
}) {
  const now = new Date().toISOString();
  const item = {
    userId: args.userId,
    screenName: args.screenName,
    emailProvided: args.emailProvided,
    validated: false,
    createdAt: now,
    updatedAt: now,
  };
  await ddb.send(
    new PutCommand({
      TableName: config.tables.users,
      Item: item,
      ConditionExpression: "attribute_not_exists(userId)",
    })
  );
  return item;
}

export async function getUser(userId: string) {
  const out = await ddb.send(new GetCommand({ TableName: config.tables.users, Key: { userId } }));
  return out.Item as any | undefined;
}

export async function updateUserEmailFlags(
  userId: string,
  flags: { emailProvided?: boolean; validated?: boolean }
) {
  const sets: string[] = ["updatedAt = :u"];
  const values: Record<string, any> = { ":u": new Date().toISOString() };
  if (flags.emailProvided !== undefined) {
    sets.push("emailProvided = :ep");
    values[":ep"] = flags.emailProvided;
  }
  if (flags.validated !== undefined) {
    sets.push("validated = :val");
    values[":val"] = flags.validated;
  }
  if (sets.length === 1) return;
  await ddb.send(
    new UpdateCommand({
      TableName: config.tables.users,
      Key: { userId },
      UpdateExpression: "SET " + sets.join(", "),
      ExpressionAttributeValues: values,
      ConditionExpression: "attribute_exists(userId)",
    })
  );
}

// Username reservation and high-level screen-name management were moved into
// `userService.ts`. Keep this file as the low-level Dynamo access layer for
// users and scores (putUser/getUser/updateUserEmailFlags/updateUserPreferences).

export async function updateUserPreferences(userId: string, patch: Record<string, any>) {
  const sets: string[] = ["updatedAt = :u"];
  const values: Record<string, any> = { ":u": new Date().toISOString() };
  if (patch.avatar !== undefined) {
    sets.push("avatar = :av");
    values[":av"] = patch.avatar;
  }
  if (patch.preferences !== undefined) {
    sets.push("preferences = :pr");
    values[":pr"] = patch.preferences;
  }
  if (sets.length === 1) return;
  await ddb.send(
    new UpdateCommand({
      TableName: config.tables.users,
      Key: { userId },
      UpdateExpression: "SET " + sets.join(", "),
      ExpressionAttributeValues: values,
      ConditionExpression: "attribute_exists(userId)",
    })
  );
}
