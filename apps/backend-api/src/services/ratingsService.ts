import {
  BatchGetCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "../config/aws.js";
import { config } from "../config/index.js";

const ddb = DynamoDBDocumentClient.from(dynamoClient);
const ratingsTable = config.tables.ratings;
const ratingSummaryTable = config.tables.ratingSummary;
const SUMMARY_BATCH_LIMIT = 100;

export type RatingSummary = {
  gameId: string;
  ratingCount: number;
  avgRating: number;
  updatedAt?: string;
};

function normalizeSummary(item: any, gameId: string): RatingSummary {
  const ratingCount = Number(item?.ratingCount ?? 0) || 0;
  const ratingSum = Number(item?.ratingSum ?? 0) || 0;
  return {
    gameId,
    ratingCount,
    avgRating: ratingCount > 0 ? ratingSum / ratingCount : 0,
    updatedAt: item?.updatedAt,
  };
}

export function validateRatingInput(gameId: unknown, rating: unknown) {
  if (!gameId || typeof gameId !== "string") throw new Error("gameId required");
  const value = Number(rating);
  if (!Number.isFinite(value)) throw new Error("rating must be a number");
  if (value < 1 || value > 5) throw new Error("rating must be between 1 and 5");
  return { gameId, rating: Math.round(value) };
}

export async function upsertRating(args: { gameId: string; userId: string; rating: number }) {
  const now = new Date().toISOString();
  const ratingKey = { gameId: args.gameId, userId: args.userId };

  const existing = await ddb.send(
    new GetCommand({ TableName: ratingsTable, Key: ratingKey })
  );
  const previousRating = Number(existing.Item?.rating ?? 0) || null;
  const createdAt = existing.Item?.createdAt || now;

  await ddb.send(
    new PutCommand({
      TableName: ratingsTable,
      Item: {
        gameId: args.gameId,
        userId: args.userId,
        rating: args.rating,
        createdAt,
        updatedAt: now,
      },
    })
  );

  const delta = args.rating - (previousRating ?? 0);
  const countDelta = previousRating ? 0 : 1;
  const summaryResult = await ddb.send(
    new UpdateCommand({
      TableName: ratingSummaryTable,
      Key: { gameId: args.gameId },
      UpdateExpression:
        "SET ratingSum = if_not_exists(ratingSum, :zero) + :delta, ratingCount = if_not_exists(ratingCount, :zero) + :count, updatedAt = :now",
      ExpressionAttributeValues: {
        ":zero": 0,
        ":delta": delta,
        ":count": countDelta,
        ":now": now,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  const summary = normalizeSummary(summaryResult.Attributes, args.gameId);
  return { ...summary, userRating: args.rating };
}

export async function getRatingSummary(gameId: string): Promise<RatingSummary> {
  const res = await ddb.send(
    new GetCommand({ TableName: ratingSummaryTable, Key: { gameId } })
  );
  if (!res.Item) {
    return { gameId, ratingCount: 0, avgRating: 0 };
  }
  return normalizeSummary(res.Item, gameId);
}

export async function getRatingSummaries(gameIds: string[]): Promise<RatingSummary[]> {
  if (!gameIds.length) return [];
  const unique = Array.from(new Set(gameIds));
  const summaries: RatingSummary[] = [];
  for (let i = 0; i < unique.length; i += SUMMARY_BATCH_LIMIT) {
    const chunk = unique.slice(i, i + SUMMARY_BATCH_LIMIT);
    const res = await ddb.send(
      new BatchGetCommand({
        RequestItems: {
          [ratingSummaryTable]: {
            Keys: chunk.map((gameId) => ({ gameId })),
          },
        },
      })
    );
    const items = res.Responses?.[ratingSummaryTable] || [];
    items.forEach((item: any) => summaries.push(normalizeSummary(item, item.gameId)));
  }
  // Ensure every requested id has a response (even if zero data)
  unique.forEach((gameId) => {
    if (!summaries.find((s) => s.gameId === gameId)) {
      summaries.push({ gameId, ratingCount: 0, avgRating: 0 });
    }
  });
  return summaries;
}

export async function getUserRating(gameId: string, userId: string) {
  const res = await ddb.send(
    new GetCommand({ TableName: ratingsTable, Key: { gameId, userId } })
  );
  return res.Item ? Number(res.Item.rating) : null;
}
