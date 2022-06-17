const path = require("path");
const fs = require("fs");

// 프로젝트 폴더의 심볼릭 링크가 해결되었는지 확인
const appDirectory = fs.realpathSync(process.cwd());
const resolveApp = (relativePath) => path.resolve(appDirectory, relativePath);

const moduleFileExtensions = [
  "web.mjs",
  "mjs",
  "web.js",
  "js",
  "web.ts",
  "ts",
  "web.tsx",
  "tsx",
  "json",
  "web.jsx",
  "jsx",
];

// webpack과 같은 순서로 파일 경로 resolve
const resolveModule = (resolveFn, filePath) => {
  const extension = moduleFileExtensions.find((_extension) =>
    fs.existsSync(resolveFn(`${filePath}.${_extension}`))
  );

  if (extension) {
    return resolveFn(`${filePath}.${extension}`);
  }

  return resolveFn(`${filePath}.js`);
};

const buildPath = process.env.BUILD_PATH || "build";

module.exports = {
  appBuild: resolveApp(buildPath),
  appHtml: resolveApp("public/index.html"),
  appIndexJs: resolveModule(resolveApp, "src/index"),
};
