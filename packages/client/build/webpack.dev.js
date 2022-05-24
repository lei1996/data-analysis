const path = require('path');
const { merge } = require('webpack-merge');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'development',
  output: {
    publicPath: '/',
  },
  devtool: 'inline-source-map',
  devServer: {
    hot: true,
    host: '0.0.0.0',
    disableHostCheck: true,
    contentBase: ['./dist'],
    historyApiFallback: {
      rewrites: [],
    },
    proxy: {
      // 接口请求代理
      '/api': {
        // target: 'http://localhost:7777',
        target: 'https://suweb.linairx.top/api',
        secure: false,
        changeOrigin: true,
        pathRewrite: { '^/api': '' },
      },
    },
  },
  plugins: [new ReactRefreshWebpackPlugin()],
});
