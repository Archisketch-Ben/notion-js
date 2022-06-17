const isProd = process.env.NODE_ENV === "production";

module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        targets: isProd
          ? ">0.2%, not dead, not op_mini all"
          : "last 1 chrome version, last 1 firefox version, last 1 safari version",
      },
    ],
  ],
  plugins: [
    // 전역 스코프 오염 x
    [
      "@babel/plugin-transform-runtime",
      {
        corejs: 3,
      },
    ],
  ],
};
