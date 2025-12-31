/**
 * Script to add username-index GSI to the users table
 * This GSI is required for username+PIN login to work
 *
 * Run with: npx ts-node scripts/add-username-gsi.ts
 * Or: npx tsx scripts/add-username-gsi.ts
 */

import { DynamoDBClient, UpdateTableCommand, DescribeTableCommand } from "@aws-sdk/client-dynamodb";

const TABLE_NAME = process.env.TABLE_USERS || "games4james-users";
const REGION = process.env.AWS_REGION || "ap-southeast-2";

const client = new DynamoDBClient({ region: REGION });

async function checkGSIExists(): Promise<boolean> {
  try {
    const result = await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    const gsiNames = result.Table?.GlobalSecondaryIndexes?.map((gsi) => gsi.IndexName) || [];
    return gsiNames.includes("username-index");
  } catch (error) {
    console.error("Error checking table:", error);
    return false;
  }
}

async function addUsernameGSI() {
  console.log(`Checking if username-index GSI exists on table: ${TABLE_NAME}`);

  const exists = await checkGSIExists();
  if (exists) {
    console.log("✅ username-index GSI already exists!");
    return;
  }

  console.log("Adding username-index GSI...");

  try {
    await client.send(
      new UpdateTableCommand({
        TableName: TABLE_NAME,
        AttributeDefinitions: [{ AttributeName: "username", AttributeType: "S" }],
        GlobalSecondaryIndexUpdates: [
          {
            Create: {
              IndexName: "username-index",
              KeySchema: [{ AttributeName: "username", KeyType: "HASH" }],
              Projection: {
                ProjectionType: "ALL", // Project all attributes for login
              },
              // On-demand capacity inherits from table, or specify provisioned:
              // ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
            },
          },
        ],
      })
    );

    console.log("✅ GSI creation initiated! It may take a few minutes to become active.");
    console.log("   Check AWS Console or run this script again to verify status.");
  } catch (error: any) {
    if (error.name === "ValidationException" && error.message?.includes("already exists")) {
      console.log("✅ GSI already exists (caught in creation)");
    } else {
      console.error("❌ Error adding GSI:", error);
      throw error;
    }
  }
}

addUsernameGSI().catch(console.error);
