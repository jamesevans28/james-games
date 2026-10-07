// DynamoDB data access layer (scores & users)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// Users
export async function putUser(args: {
  userId: string;
  screenName: string;
  emailProvided: boolean;
  email?: string | null;
  validated?: boolean;
  betaTester?: boolean;
  admin?: boolean;
}) {
  const now = new Date().toISOString();
  const item = {
    userId: args.userId,
    screenName: args.screenName,
    emailProvided: args.emailProvided,
    email: args.email ?? null,
    validated: args.validated ?? false,
    xpLevel: 1,
    xpProgress: 0,
    xpTotal: 0,
    xpUpdatedAt: now,
    createdAt: now,
    updatedAt: now,
    betaTester: Boolean(args.betaTester),
    admin: Boolean(args.admin),
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

export async function updateUserEmailMetadata(
  userId: string,
  flags: { email?: string | null; emailProvided?: boolean; validated?: boolean }
) {
  const sets: string[] = ["updatedAt = :u"];
  const values: Record<string, any> = { ":u": new Date().toISOString() };
  if (flags.email !== undefined) {
    sets.push("email = :em");
    values[":em"] = flags.email;
  }
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
// users and scores (putUser/getUser/updateUserEmailMetadata/updateUserPreferences).

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
