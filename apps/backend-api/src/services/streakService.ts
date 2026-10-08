/* eslint-disable @typescript-eslint/no-unsafe-assignment -- TODO T6.3: untyped DynamoDB items; the Drizzle repository layer gives these real row types */
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "../config/aws.js";
import { config } from "../config/index.js";
import { clampTzOffset, localDayFor, nextStreak } from "./streakRules.js";
import { isConditionalCheckFailed } from "../lib/errors.js";

const ddb = DynamoDBDocumentClient.from(dynamoClient);

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastLoginDate: string | null; // YYYY-MM-DD in user's timezone
  streakUpdatedAt: string | null;
}

/**
 * Get streak data for a user.
 */
export async function getStreakData(userId: string): Promise<StreakData> {
  const result = await ddb.send(
    new GetCommand({
      TableName: config.tables.users,
      Key: { userId },
      ProjectionExpression: "currentStreak, longestStreak, lastLoginDate, streakUpdatedAt",
    }),
  );

  const item = result.Item || {};
  return {
    currentStreak: item.currentStreak ?? 0,
    longestStreak: item.longestStreak ?? 0,
    lastLoginDate: item.lastLoginDate ?? null,
    streakUpdatedAt: item.streakUpdatedAt ?? null,
  };
}

/**
 * Record a daily login. The day comes from the server clock (plus the player's
 * clamped UTC offset), never from a date the client sends. The write is
 * conditional on streakUpdatedAt so concurrent check-ins can't double-count.
 */
export async function recordDailyLogin(
  userId: string,
  tzOffsetMinutes: unknown,
  nowMs: number = Date.now(),
): Promise<{ streak: StreakData; extended: boolean; isNewStreak: boolean }> {
  const today = localDayFor(nowMs, clampTzOffset(tzOffsetMinutes));
  const current = await getStreakData(userId);
  const outcome = nextStreak(current, today);
  if (!outcome.changed) return { streak: current, extended: false, isNewStreak: false };

  const now = new Date(nowMs).toISOString();
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: config.tables.users,
        Key: { userId },
        UpdateExpression:
          "SET currentStreak = :cs, longestStreak = :ls, lastLoginDate = :ld, streakUpdatedAt = :su, updatedAt = :u",
        ConditionExpression: current.streakUpdatedAt
          ? "streakUpdatedAt = :prev"
          : "attribute_not_exists(streakUpdatedAt)",
        ExpressionAttributeValues: {
          ":cs": outcome.next.currentStreak,
          ":ls": outcome.next.longestStreak,
          ":ld": outcome.next.lastLoginDate,
          ":su": now,
          ":u": now,
          ...(current.streakUpdatedAt ? { ":prev": current.streakUpdatedAt } : {}),
        },
      }),
    );
  } catch (err) {
    if (!isConditionalCheckFailed(err)) throw err;
    // Another check-in won the race; report the stored state without changes.
    return { streak: await getStreakData(userId), extended: false, isNewStreak: false };
  }

  return {
    streak: { ...outcome.next, streakUpdatedAt: now },
    extended: outcome.extended,
    isNewStreak: outcome.isNewStreak,
  };
}

export default {
  getStreakData,
  recordDailyLogin,
};
