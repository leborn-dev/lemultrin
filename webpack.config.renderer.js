/* eslint-disable */
const { getConfig, dev } = require('./webpack.config.base');
const { join } = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

/* eslint-enable */

const PORT = 4444;
const INCLUDE = join(__dirname, 'src');

const getHtml = (scope, name) => {
  return new HtmlWebpackPlugin({
    title: 'Multrin',
    template: 'static/pages/app.html',
    filename: `${name}.html`,
    chunks: [`vendor.${scope}`, name],
  });
};

const applyEntries = (scope, config, entries) => {
  for (const entry of entries) {
    config.entry[entry] = [`./src/renderer/views/${entry}`];
    config.plugins.push(getHtml(scope, entry));


  }
};

const getBaseConfig = name => {
  const config = {
    plugins: [],

    output: {},
    entry: {},

    module: {
      rules: [
        {
          test: /\.(png|gif|jpg|woff2|ttf|svg)$/,
          include: INCLUDE,
          type: 'asset/resource',
        },
      ],
    },

    optimization: {
      splitChunks: {
        cacheGroups: {
          vendor: {
            chunks: 'initial',
            name: `vendor.${name}`,
            minChunks: 2,
          },
        },
      },
    },
  };


  return config;
};

const appConfig = getConfig(getBaseConfig('app'), {
  target: 'electron-renderer',

  devServer: {
    static: join(__dirname, 'build'),
    host: '127.0.0.1',
    port: PORT,
    hot: true,
  },
});

applyEntries('app', appConfig, ['app', 'menu']);

module.exports = [appConfig];
