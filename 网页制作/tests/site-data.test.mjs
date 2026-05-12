import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const siteDataPath = path.join(projectRoot, "src/_data/site.js");
const envNames = [
  "SITE_URL",
  "OG_IMAGE",
  "CONTACT_EMAIL",
  "CONTACT_WECHAT",
  "CUSTOMER_HOURS",
  "BUSINESS_NAME",
  "STUDIO_BOOKING"
];

function loadSiteData(overrides = {}) {
  const previous = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  for (const name of envNames) delete process.env[name];
  Object.assign(process.env, overrides);

  try {
    delete require.cache[require.resolve(siteDataPath)];
    return require(siteDataPath);
  } finally {
    delete require.cache[require.resolve(siteDataPath)];
    for (const name of envNames) {
      if (previous[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = previous[name];
      }
    }
  }
}

describe("site data launch values", () => {
  it("trims deployment environment values before rendering", () => {
    const site = loadSiteData({
      SITE_URL: "  https://www.scent-atoll.test/  ",
      OG_IMAGE: "  https://www.scent-atoll.test/share.jpg  ",
      CONTACT_EMAIL: "  hello@scent-atoll.test  ",
      CONTACT_WECHAT: "  ScentAtoll  ",
      CUSTOMER_HOURS: "  11:00 - 19:00  ",
      BUSINESS_NAME: "  Scent Atoll Studio Ltd  ",
      STUDIO_BOOKING: "  Wechat appointment  "
    });

    assert.equal(site.url, "https://www.scent-atoll.test");
    assert.equal(site.shareImage, "https://www.scent-atoll.test/share.jpg");
    assert.equal(site.contactEmail, "hello@scent-atoll.test");
    assert.equal(site.contactWechat, "ScentAtoll");
    assert.equal(site.customerHours, "11:00 - 19:00");
    assert.equal(site.businessName, "Scent Atoll Studio Ltd");
    assert.equal(site.studioBooking, "Wechat appointment");
  });

  it("falls back when launch environment values are blank", () => {
    const site = loadSiteData({
      SITE_URL: "   ",
      OG_IMAGE: "   ",
      CONTACT_EMAIL: "   ",
      CONTACT_WECHAT: "   ",
      CUSTOMER_HOURS: "   ",
      BUSINESS_NAME: "   ",
      STUDIO_BOOKING: "   "
    });

    assert.equal(site.url, "https://scent-atoll.example.com");
    assert.equal(site.shareImage, "https://scent-atoll.example.com/og-image.png");
    assert.equal(site.contactEmail, "hello@scent-atoll.example.com");
    assert.equal(site.contactWechat, "上线前填写");
    assert.equal(site.customerHours, "12:00 - 20:00");
    assert.equal(site.businessName, "馥屿 Scent Atoll");
    assert.equal(site.studioBooking, "通过客服微信预约");
  });
});
