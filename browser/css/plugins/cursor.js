const _ = require('lodash')

module.exports = function ({ cursorTypes = [], cursorImages = {}, variants = [] }) {
  return function ({ e, addUtilities }) {
    addUtilities([
        ..._.map(cursorTypes, cursor => ({
          [`.${e(`cursor-${cursor}`)}`]: { cursor }
        })),
        ..._.map(cursorImages, (image, cursor) => ({
          [`.${e(`cursor-${cursor}`)}`]: { cursor: `url("${image}"), auto` }
        })),
      ],
      variants)
  }
}

