module.exports = function (wallaby) {
  return {
    debug: true,

    files: [
      'server.ts'
    ],

    tests: [
      '__test__/**/*.ts'
    ],

    env: {
      type: 'node'
    },

    testFramework: 'ava'
  };
};
