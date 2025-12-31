// AWS SDK clients (initialized once per cold start)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { config } from "./index.js";

export const dynamoClient = new DynamoDBClient({ region: config.region });
