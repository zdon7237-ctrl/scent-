module.exports = function configure(eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets/styles.css": "styles.css" });
  eleventyConfig.addPassthroughCopy({ "src/assets/data.js": "data.js" });
  eleventyConfig.addPassthroughCopy({ "src/assets/script.js": "script.js" });
  eleventyConfig.addPassthroughCopy({ "src/assets/js": "assets/js" });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      output: "dist"
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    templateFormats: ["njk", "md"]
  };
};
