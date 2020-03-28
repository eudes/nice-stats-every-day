require('dotenv').config();
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  context: path.resolve(__dirname, "./app"),
  entry: './app.js',
  output: {
    filename: './assets/bundle.js',
    path: path.resolve(__dirname, './public')
  },
  module: {
    rules: [{
      test: /\.js$/,
      exclude: [/node_modules/],
      use: [{
          loader: 'babel-loader',
          options: {
            presets: ['env'],
            plugins:  ["@babel/plugin-transform-runtime"],
          }
      }]
    }, {
      test : /\.css$/,
      use : ['style-loader', 'css-loader']
    }, {
      test: /\.html$/,
      use : {
        loader: 'html-loader'
      }
    }]
  },
  plugins: [
    new HtmlWebpackPlugin({ filename: 'index.html', template: 'app.html'}),
  ],
  devServer: {
    port : process.env.WEBPACK_PORT,
    contentBase: path.resolve(__dirname, './public'),
    proxy : {
      "/": { target: `http://localhost:${process.env.PORT}` }
    }
  }
};