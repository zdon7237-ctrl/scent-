module.exports = function configure(eleventyConfig) {
  const isPublicBuild = process.env.PUBLIC_BUILD === "true";
  const outputDir = process.env.ELEVENTY_OUTPUT || "dist";

  eleventyConfig.addPassthroughCopy({ "src/assets/styles.css": "styles.css" });
  eleventyConfig.addPassthroughCopy({ "src/assets/data.js": "data.js" });
  eleventyConfig.addPassthroughCopy({ "src/assets/script.js": "script.js" });
  eleventyConfig.addPassthroughCopy({ "src/assets/og-image.png": "og-image.png" });
  if (!isPublicBuild) {
    eleventyConfig.addPassthroughCopy({ "src/assets/js": "assets/js" });
  }

  return {
    dir: {
      input: "src",
      includes: "_includes",
      output: outputDir
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    templateFormats: ["njk", "md"]
  };
};
