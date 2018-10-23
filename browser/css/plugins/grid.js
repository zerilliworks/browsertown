const _ = require('lodash')

module.exports = function ({ grids = _.range(1, 12), fixedGrids = {}, gaps = {}, variants = ['responsive']}) {
  return function ({ e, addUtilities }) {
    addUtilities([
      { '.grid': { display: 'grid' } },
      { '.grid-dense': { gridAutoFlow: 'dense' } },
      { '.grid-flow-columns': { gridAutoFlow: 'column' } },
      { '.grid-flow-rows': { gridAutoFlow: 'row' } },
      { '.grid-flow-columns-dense': { gridAutoFlow: 'column dense' } },
      { '.grid-flow-rows-dense': { gridAutoFlow: 'row dense' } },
      ..._.map(gaps, (size, name) => ({
        [`.${e(`grid-gap-${name}`)}`]: { gridGap: size },
      })),
      ..._.map(fixedGrids, (size, name) => ({
        [`.${e(`grid-fixed-${name}`)}`]: {
          gridTemplateColumns: `${size}`,
          gridTemplateRows: `${size}`,
          gridAutoColumns: `${size}`,
          gridAutoRows: `${size}`,
        },
      })),
      ...grids.map(columns => ({
        [`.grid-columns-${columns}`]: {
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
        },
        [`.grid-rows-${columns}`]: {
          gridTemplateRows: `repeat(${columns}, 1fr)`,
        }
      })),
      ..._.range(1, _.max(grids) + 1).map(span => ({
        [`.col-span-${span}`]: {
          gridColumnEnd: `span ${span}`,
        },
        [`.row-span-${span}`]: {
          gridRowEnd: `span ${span}`,
        }
      })),
      ..._.range(1, _.max(grids) + 2).map(line => ({
        [`.col-start-${line}`]: {
          gridColumnStart: `${line}`,
        },
        [`.col-end-${line}`]: {
          gridColumnEnd: `${line}`,
        },
        [`.row-start-${line}`]: {
          gridRowStart: `${line}`,
        },
        [`.row-end-${line}`]: {
          gridRowEnd: `${line}`,
        },
      })),
    ], variants)
  }
}

