const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");

const dotenv = require("dotenv").config({ path: __dirname + "/.env" });

const banner = require("./src/config/banner");
const paths = require("./src/config/paths");

const shouldUseSourceMap = process.env.GENERATE_SOURCEMAP !== "false";

module.exports = function () {
  const isEnvDevelopment = process.env.NODE_ENV === "development";
  const isEnvProduction = process.env.NODE_ENV === "production";
  console.log(process.env);
  console.log(dotenv);

  const plugins = [
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: [
        "**/*",
        // build 폴더 안의 모든 것을 지우도록 설정
        path.resolve(process.cwd(), "build/**/*"),
      ],
    }),
    new HtmlWebpackPlugin(
      Object.assign(
        {},
        {
          inject: true,
          template: paths.appHtml,
          templateParameters: { title: isEnvProduction ? "" : "(개발모드) " },
          // 정적 파일을 불러올 때 쿼리문자열에 웹팩 해쉬값을 추가 (브라우저에게 새로운 버전이 있음을 알려주기 위함)
          hash: true,
        },

        isEnvProduction
          ? {
              minify: {
                removeComments: true,
                collapseWhitespace: true,
                removeRedundantAttributes: true,
                useShortDoctype: true,
                removeEmptyAttributes: true,
                removeStyleLinkTypeAttributes: true,
                keepClosingSlash: true,
                minifyJS: true,
                minifyCSS: true,
                minifyURLs: true,
              },
            }
          : undefined
      )
    ),
    new webpack.BannerPlugin(banner),
    new webpack.DefinePlugin({
      "process.env": JSON.stringify(dotenv.parsed),
      NODE_ENV: process.env.NODE_ENV || "development",
    }),
  ];

  isEnvProduction &&
    plugins.push(
      new MiniCssExtractPlugin({
        filename: "static/css/[name].[contenthash:8].css",
        chunkFilename: "static/css/[name].[contenthash:8].chunk.css",
      })
    );

  return {
    mode: isEnvProduction ? "production" : isEnvDevelopment && "development",
    entry: {
      main: paths.appIndexJs,
      // main: paths.appHtml,
    },
    output: {
      path: paths.appBuild,
      filename: isEnvProduction
        ? "static/js/[name].[contenthash:8].js"
        : isEnvDevelopment && "static/js/[name].[hash].bundle.js",
      chunkFilename: isEnvProduction
        ? "static/js/[name].[contenthash:8].chunk.js"
        : isEnvDevelopment && "static/js/[name].chunk.js",
      assetModuleFilename: "static/media/[name].[hash][ext]",
    },
    resolve: {
      fallback: {
        fs: false,
        path: require.resolve("path-browserify"),
        os: require.resolve("os-browserify/browser"),
      },
    },
    devServer: {
      port: 9000,
      historyApiFallback: true,
    },
    devtool: isEnvProduction
      ? shouldUseSourceMap
        ? "source-map"
        : false
      : isEnvDevelopment && "cheap-module-source-map",
    module: {
      rules: [
        {
          test: /\.(js)$/,
          exclude: /node_modules/,
          loader: "babel-loader",
        },
        {
          test: /\.(png|jp(e*)g|svg|gif)$/,
          loader: "file-loader",
          options: {
            name: "static/media/[name].[hash].[ext]",
          },
        },
        {
          test: /\.css$/,
          use: [
            isEnvProduction ? MiniCssExtractPlugin.loader : "style-loader",
            "css-loader",
          ],
        },
      ],
    },
    plugins,
    optimization: {
      minimize: isEnvProduction,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: true,
            },
            // 참고: https://github.com/terser/terser#mangle-options
            mangle: {
              safari10: true,
            },
          },
        }),
      ],
    },
  };
};
