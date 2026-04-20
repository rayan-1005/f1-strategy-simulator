import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { connectMongo } from "./db/mongo.js";
import { redis } from "./services/redis.js";
import { log } from "./utils/log.js";

async function main() {
  log.info("api-gateway", "starting...");

  await connectMongo();
  log.ok("api-gateway", "mongo connected");

  await redis.ping();
  log.ok("api-gateway", "redis connected");

  const app = createApp();
  app.listen(env.PORT, () => {
    log.ok("api-gateway", `listening on http://127.0.0.1:${env.PORT}`);
  });
}

main().catch((e) => {
  log.error("api-gateway", "fatal startup error", e);
  process.exit(1);
});
