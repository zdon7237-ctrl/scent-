import { closePool } from "../server/src/db.mjs";
import { seed } from "../server/src/seed.mjs";

try {
  const result = await seed();
  if (result.skipped) {
    console.log(`Seed skipped: ${result.reason}`);
  } else {
    console.log(`Seed complete: ${JSON.stringify(result.counts)}`);
  }
} finally {
  await closePool();
}
