import { closePool } from "../server/src/db.mjs";
import { migrate } from "../server/src/migrate.mjs";

try {
  const result = await migrate();
  if (result.skipped) {
    console.log(`Migration skipped: ${result.reason}`);
  } else {
    console.log(`Migration applied: ${result.migrationId}`);
  }
} finally {
  await closePool();
}
