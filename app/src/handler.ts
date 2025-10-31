// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import serverless from "serverless-http";
import { app } from "./index.js";

export const handler = serverless(app);
