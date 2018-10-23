export default function () {
  let options = {
    failFast: true,
    cache: true,
  }

  if (process.env.CI) {
    options.failFast = false
  }

  return {
    files: [
      "__test__/**/*.{ts,tsx}"
    ],
    sources: [
      "**/*.{ts,tsx}",
      "!__test__/**/*"
    ],
    compileEnhancements: false,
    extensions: ['ts', 'tsx'],
    require: [
      'ts-node/register'
    ],
    cache: options.cache,
    failFast: options.failFast,
    concurrency: 4
  }
}
