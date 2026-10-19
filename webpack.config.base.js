/* eslint-disable */
const { resolve } = require('path');
const { merge } = require('webpack-merge');
const INCLUDE = resolve(__dirname, 'src');

const dev = process.env.ENV === 'dev';

function getExternals(externals) {
  const res = {};
  for (const e of externals) {
    res[e] = `require('${e}')`;
  }
  return res;
}

const config = {
  mode: dev ? 'development' : 'production',

  devtool: dev ? 'eval-source-map' : false,

  plugins: [],

  output: {
    path: resolve(__dirname, 'build'),
    filename: '[name].bundle.js',
  },

  module: {
    rules: [
      {
        test: /\.tsx|ts$/,
        use: [{ loader: 'ts-loader', options: { transpileOnly: true } }],

        include: INCLUDE,
      },
    ],
  },

  node: {
    __dirname: false,
    __filename: false,
  },

  resolve: {
    modules: ['node_modules'],
    extensions: ['.js', '.jsx', '.tsx', '.ts', '.json'],
    alias: {
      '~': INCLUDE,
    },
  },

  externals: getExternals(['uiohook-napi', 'node-window-manager', 'extract-file-icon', '@electron/remote', '@electron/remote/main']),
};

function getConfig(...cfg) {
  return merge(config, ...cfg);
}

module.exports = { getConfig, dev };
