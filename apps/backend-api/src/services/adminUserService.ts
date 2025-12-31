import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { Buffer } from "node:buffer";
import { dynamoClient } from "../config/aws.js";
import { config } from "../config/index.js";
import { getUser, updateUserEmailMetadata } from "./dynamoService.js";

const ddb = DynamoDBDocumentClient.from(dynamoClient);

export type AdminUserSummary = {
  userId: string;
  screenName?: string | null;
  email?: string | null;
  emailProvided?: boolean;
  validated?: boolean;
  betaTester?: boolean;
  admin?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function normalizeUser(item: Record<string, any>): AdminUserSummary {
  return {
    userId: item.userId,
    screenName: item.screenName ?? null,
    email: item.email ?? null,
    emailProvided: item.emailProvided ?? false,
    validated: item.validated ?? false,
    betaTester: Boolean(item.betaTester),
    admin: Boolean(item.admin),
    createdAt: item.createdAt ?? null,
    updatedAt: item.updatedAt ?? null,
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

export async function listUsers(opts: { limit?: number; cursor?: string; search?: string }) {
  const limit = Math.min(Math.max(Number(opts.limit) || 25, 5), 100);
  let exclusiveStartKey = decodeCursor(opts.cursor);
  const projection =
    "#id, screenName, email, emailProvided, validated, betaTester, admin, createdAt, updatedAt";
  let items: AdminUserSummary[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;

  for (let page = 0; page < (opts.search ? 5 : 1); page++) {
    const resp = await ddb.send(
      new ScanCommand({
        TableName: config.tables.users,
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey,
        ProjectionExpression: projection,
        ExpressionAttributeNames: { "#id": "userId" },
      })
    );
    const pageItems = (resp.Items || []).map((item) => normalizeUser(item as any));
    if (opts.search) {
      const query = opts.search.toLowerCase();
      items = items.concat(
        pageItems.filter((user) => {
          return (
            user.userId.toLowerCase().includes(query) ||
            (user.screenName ?? "").toLowerCase().includes(query) ||
            (user.email ?? "").toLowerCase().includes(query)
          );
        })
      );
    } else {
      items = pageItems;
    }
    lastEvaluatedKey = resp.LastEvaluatedKey as any;
    if (!opts.search || items.length >= limit || !lastEvaluatedKey) break;
    exclusiveStartKey = lastEvaluatedKey;
  }

  return {
    items: items.slice(0, limit),
    nextCursor: encodeCursor(lastEvaluatedKey),
  };
}

export async function getAdminUser(userId: string) {
  const profile = await getUser(userId);
  const user: AdminUserSummary = normalizeUser(profile || { userId });
  return {
    ...user,
    email: user.email ?? null,
    emailVerified: profile?.validated ?? false,
    emailProvided: user.emailProvided ?? false,
    accountType: profile?.accountType ?? "unknown",
    enabled: true,
  };
}

export async function updateAdminUser(
  userId: string,
  changes: {
    email?: string;
    betaTester?: boolean;
    admin?: boolean;
  }
) {
  // Note: Password management is now handled through Firebase Auth.
  // Admin can only update DynamoDB metadata (betaTester, admin flags).
  if (!changes.email && changes.betaTester === undefined && changes.admin === undefined) {
    throw new Error("no_changes_provided");
  }

  const tasks: Array<Promise<any>> = [];

  if (changes.email) {
    // Update email in DynamoDB only (Firebase manages actual auth email)
    tasks.push(updateUserEmailMetadata(userId, { email: changes.email, emailProvided: true }));
  }

  if (changes.betaTester !== undefined || changes.admin !== undefined) {
    const sets = ["updatedAt = :u"];
    const values: Record<string, any> = { ":u": new Date().toISOString() };
    if (changes.betaTester !== undefined) {
      sets.push("betaTester = :bt");
      values[":bt"] = Boolean(changes.betaTester);
    }
    if (changes.admin !== undefined) {
      sets.push("admin = :ad");
      values[":ad"] = Boolean(changes.admin);
    }
    tasks.push(
      ddb.send(
        new UpdateCommand({
          TableName: config.tables.users,
          Key: { userId },
          UpdateExpression: "SET " + sets.join(", "),
          ExpressionAttributeValues: values,
          ConditionExpression: "attribute_exists(userId)",
        })
      )
    );
  }

  await Promise.all(tasks);
  return getAdminUser(userId);
}
