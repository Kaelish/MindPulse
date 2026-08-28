const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: path.resolve(__dirname, 'web/index.tsx'),
  output: {
    path: path.resolve(__dirname, 'web-dist'),
    filename: 'bundle.js',
    clean: true,
  },
  resolve: {
    extensions: ['.web.tsx', '.tsx', '.web.ts', '.ts', '.web.js', '.js'],
    alias: {
      'react-native$': 'react-native-web',
    },
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx|js)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['module:@react-native/babel-preset'],
          },
        },
      },
    ],
  },
  plugins: [new HtmlWebpackPlugin({ template: path.resolve(__dirname, 'web/index.html') })],
  devServer: {
    port: 8082,
    historyApiFallback: true,
    static: path.resolve(__dirname, 'web-dist'),
  },
};