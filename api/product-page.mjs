import { handleProductPageRequest } from "../网页制作/server/src/app.mjs";

export default async function handler(req, res) {
  return handleProductPageRequest(req, res);
}
