import { handleRequest } from "../server/src/app.mjs";

export default async function handler(req, res) {
  return handleRequest(req, res);
}
