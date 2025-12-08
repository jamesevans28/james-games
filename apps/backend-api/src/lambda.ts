// Lambda handler wrapper for the Express app
// Uses `serverless-http` to convert the Express app into a Lambda-compatible handler
import serverless from "serverless-http";
import { app } from "./index.js";

// Export a named handler for AWS Lambda / API Gateway
export const handler = serverless(app);

export default handler;
