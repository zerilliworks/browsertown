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
      "__test__/*.ts"
    ],
    sources: [
      "./*.ts",
      "!__test__/*.ts"
    ],
    compileEnhancements: false,
    extensions: ['ts'],
    require: [
      'ts-node/register'
    ],
    cache: options.cache,
    failFast: options.failFast,
    concurrency: 4,
    timeout: '10s'
  }
}
