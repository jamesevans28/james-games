// AWS SDK clients (initialized once per cold start)

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { config } from "./index.js";

export const dynamoClient = new DynamoDBClient({ region: config.region });
