import { app } from "./index.js";
// Minimal declaration for Node workspace-free typing
declare const process: any;

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`Local API server listening on http://localhost:${port}`);
});
