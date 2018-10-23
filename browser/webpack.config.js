const path = require('path')
const webpack = require('webpack')
const { CheckerPlugin } = require('awesome-typescript-loader')
const MiniCssExtractPlugin = require("mini-css-extract-plugin")
const CleanWebpackPlugin = require('clean-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')
var tailwindcss = require('tailwindcss')

function recursiveIssuer(m) {
  if (m.issuer) {
    return recursiveIssuer(m.issuer);
  }
  else if (m.name) {
    return m.name;
  }
  else {
    return false;
  }
}

const plugins = {
  production: [
    // Only run in production. Produce minified JS.
    new UglifyJsPlugin({
      test: /\.jsx?/i
    })
  ],
  development: []
}

module.exports = {
  devtool: 'source-map',
  entry: {
    browsertown: [
      path.resolve(path.join(__dirname, 'webapp/app.ts')),
      path.resolve(path.join(__dirname, 'webapp/css/app.css'))
    ]
  },
  output: {
    path: path.resolve(path.join(__dirname, '/priv/static')),
    filename: 'js/[name].bundle.js'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'awesome-typescript-loader'
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          { loader: 'css-loader', options: { importLoaders: 1 } },
          {
            loader: 'postcss-loader', options: {
              plugins: [
                require('postcss-nested'),
                tailwindcss('./webapp/tailwind.js'),
                require('cssnano')
              ]
            }
          },
        ]
      },
      {
        test: /\.(png|woff|woff2|eot|ttf|svg)$/,
        use: [
          {
            loader: 'url-loader',
            options: {
              limit: 65536
            }
          }
        ]
      }
    ]
  },
  optimization: {
    splitChunks: {
      cacheGroups: {
        legacyStyles: {
          name: 'browsertown',
          test: (m, c, entry = 'browsertown') => m.constructor.name === 'CssModule' && recursiveIssuer(m) === entry,
          chunks: 'all',
          enforce: true
        }
      }
    }
  },
  plugins: [
    new CleanWebpackPlugin([
      path.join(__dirname, 'priv/static')
    ]),
    // Important to keep React file size down
    new webpack.DefinePlugin({
      'process.env': {
        'NODE_ENV': JSON.stringify(env)
      }
    }),
    // Type checker for `awesome-typescript-loader`
    new CheckerPlugin(),
    // Add this plugin so Webpack won't output the files when anything errors
    // during the build process
    // new webpack.NoEmitOnErrorsPlugin(),
    new MiniCssExtractPlugin({
      filename: 'css/[name].css',
    })
  ]
    .concat(plugins[env])
    .concat([
      new CopyWebpackPlugin([
        { from: path.join(__dirname, 'webapp/static') },
      ])
    ]),
  resolve: {
    modules: [
      'node_modules',
      'webapp/lib',
      'webapp'
    ],
    // Add '.ts' and '.tsx' as resolvable extensions.
    extensions: ['.ts', '.tsx', '.js', '.json'],
    alias: {
      phoenix: path.join(__dirname, '/deps/phoenix/priv/static/phoenix.js'),
      phoenix_html: path.join(__dirname, '/deps/phoenix_html/priv/static/phoenix_html.js')
    }
  }
}
