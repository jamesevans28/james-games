const fs = require("fs");
const https = require("https");

const main = async () => {
  const args = process.argv.slice(2);
  // Allow disabling this lightweight telemetry ping in CI or by env var
  if (process.env.DISABLE_TELEMETRY === "1" || process.env.CI === "true") {
    process.exit(0);
  }
  const packageData = JSON.parse(fs.readFileSync("./package.json", "utf8"));
  const event = args[0] || "unknown";
  const phaserVersion = packageData.dependencies.phaser;

  const options = {
    hostname: "gryzor.co",
    port: 443,
    path: `/v/${event}/${phaserVersion}/${packageData.name}`,
    method: "GET",
  };

  try {
    const req = https.request(options, (res) => {
      res.on("data", () => {});
      res.on("end", () => {
        process.exit(0);
      });
    });

    req.on("error", (/* error */) => {
      // don't fail the process if the ping fails; it's optional telemetry
      process.exit(0);
    });

    req.end();
  } catch (error) {
    // Silence any errors - telemetry must never block development or CI
    // eslint-disable-next-line no-console
    // console.debug('telemetry ping skipped', error);
    process.exit(0);
  }
};

main();
