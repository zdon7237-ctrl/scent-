const failures = [];

function value(name) {
  return String(process.env[name] || "").trim();
}

const required = [
  "VERCEL_TOKEN",
  "VERCEL_ORG_ID",
  "VERCEL_PROJECT_ID",
  "GITHUB_RELEASE_AUDIT_TOKEN",
  "PRODUCTION_URL",
  "PRODUCTION_DATABASE_URL"
];

for (const name of required) {
  if (!value(name)) failures.push(`${name} is required by the protected Production release.`);
}

if (value("RELEASE_CONFIRMATION") !== "RELEASE") {
  failures.push("RELEASE_CONFIRMATION must equal RELEASE.");
}

if (value("GITHUB_REF") !== "refs/heads/main") {
  failures.push("Production releases must be dispatched from refs/heads/main.");
}

for (const [name, protocol] of [["PRODUCTION_URL", "https:"], ["PRODUCTION_DATABASE_URL", "postgresql:"]]) {
  const current = value(name);
  if (!current) continue;
  try {
    const parsed = new URL(current);
    if (name === "PRODUCTION_URL") {
      if (parsed.protocol !== protocol || parsed.username || parsed.password || !["", "/"].includes(parsed.pathname) || parsed.search || parsed.hash) {
        failures.push("PRODUCTION_URL must be an HTTPS origin without credentials, path, query, or fragment.");
      }
    } else if (!/^postgres(?:ql)?:$/.test(parsed.protocol)) {
      failures.push("PRODUCTION_DATABASE_URL must be a PostgreSQL connection URL.");
    }
  } catch {
    failures.push(`${name} must be a valid URL.`);
  }
}

if (failures.length) {
  console.error("Production release control check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Production release control check passed.");
