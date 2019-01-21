require('dotenv').config()
const withTypescript = require('@zeit/next-typescript')
const withCSS = require('@zeit/next-css')
module.exports = withCSS(withTypescript({
  publicRuntimeConfig: {
    omniverseUrl: process.env.OMNIVERSE_URL
  }
}))
