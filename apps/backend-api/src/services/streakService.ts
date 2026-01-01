import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "../config/aws.js";
import { config } from "../config/index.js";

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
    })
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
 * Record a daily login and update streak.
 * @param userId - The user's ID
 * @param todayDate - Today's date in YYYY-MM-DD format (in user's timezone)
 * @returns The updated streak data and whether the streak was extended
 */
export async function recordDailyLogin(
  userId: string,
  todayDate: string
): Promise<{ streak: StreakData; extended: boolean; isNewStreak: boolean }> {
  // Get current streak data
  const current = await getStreakData(userId);
  const now = new Date().toISOString();

  // If already logged in today, no change
  if (current.lastLoginDate === todayDate) {
    return { streak: current, extended: false, isNewStreak: false };
  }

  // Check if yesterday was the last login (streak continues)
  const yesterday = getYesterday(todayDate);
  const isConsecutive = current.lastLoginDate === yesterday;
  const isNewStreak = !isConsecutive && current.currentStreak > 0;

  let newStreak: number;
  if (isConsecutive) {
    // Extend the streak
    newStreak = current.currentStreak + 1;
  } else {
    // Start a new streak
    newStreak = 1;
  }

  const newLongest = Math.max(current.longestStreak, newStreak);

  // Update the user record
  await ddb.send(
    new UpdateCommand({
      TableName: config.tables.users,
      Key: { userId },
      UpdateExpression:
        "SET currentStreak = :cs, longestStreak = :ls, lastLoginDate = :ld, streakUpdatedAt = :su, updatedAt = :u",
      ExpressionAttributeValues: {
        ":cs": newStreak,
        ":ls": newLongest,
        ":ld": todayDate,
        ":su": now,
        ":u": now,
      },
    })
  );

  const updatedStreak: StreakData = {
    currentStreak: newStreak,
    longestStreak: newLongest,
    lastLoginDate: todayDate,
    streakUpdatedAt: now,
  };

  // Extended means streak went from >= 1 to >= 2 (worth celebrating)
  const extended = isConsecutive && newStreak >= 2;

  return { streak: updatedStreak, extended, isNewStreak };
}

/**
 * Get yesterday's date given today's date in YYYY-MM-DD format.
 */
function getYesterday(todayDate: string): string {
  const [year, month, day] = todayDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);
  return formatDate(date);
}

/**
 * Format a date as YYYY-MM-DD.
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default {
  getStreakData,
  recordDailyLogin,
};
