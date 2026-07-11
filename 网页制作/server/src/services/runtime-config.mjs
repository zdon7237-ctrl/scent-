export class ServiceConfigurationError extends Error {
  constructor(service, missing = [], message = "") {
    const names = [...new Set(missing.filter(Boolean))];
    super(message || `${service} is not configured: missing ${names.join(", ")}.`);
    this.name = "ServiceConfigurationError";
    this.code = "SERVICE_CONFIGURATION_ERROR";
    this.service = service;
    this.missing = names;
  }
}

export function deploymentEnvironment(env = process.env) {
  const explicit = String(env.DEPLOYMENT_ENV || "").trim().toLowerCase();
  if (explicit) return explicit;
  return String(env.NODE_ENV || "development").trim().toLowerCase() || "development";
}

export function isProductionEnvironment(env = process.env) {
  return deploymentEnvironment(env) === "production";
}

export function envString(env, ...names) {
  for (const name of names) {
    const value = String(env?.[name] || "").trim();
    if (value) return value;
  }
  return "";
}
