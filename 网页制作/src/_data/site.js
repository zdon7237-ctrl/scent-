const fallbackUrl = "https://scent-atoll.example.com";

function envValue(name, fallback = "") {
  const value = String(process.env[name] || "").trim();
  return value || fallback;
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

const url = trimTrailingSlash(envValue("SITE_URL", fallbackUrl));
const shareImage = envValue("OG_IMAGE", `${url}/og-image.png`);
const isPublicBuild = process.env.PUBLIC_BUILD === "true";

function imageType(value) {
  const cleanValue = String(value || "").split("?")[0].split("#")[0].toLowerCase();
  if (cleanValue.endsWith(".jpg") || cleanValue.endsWith(".jpeg")) return "image/jpeg";
  if (cleanValue.endsWith(".webp")) return "image/webp";
  return "image/png";
}

module.exports = {
  name: "馥屿 Scent Atoll",
  shortName: "馥屿",
  url,
  isPublicBuild,
  isPlaceholderDomain: url.includes("example.com"),
  locale: "zh_CN",
  themeColor: "#f7f1e8",
  shareImage,
  shareImageType: imageType(shareImage),
  contactEmail: envValue("CONTACT_EMAIL", "hello@scent-atoll.example.com"),
  contactWechat: envValue("CONTACT_WECHAT", "上线前填写"),
  customerHours: envValue("CUSTOMER_HOURS", "12:00 - 20:00"),
  businessName: envValue("BUSINESS_NAME", "馥屿 Scent Atoll"),
  studioBooking: envValue("STUDIO_BOOKING", "通过客服微信预约")
};
