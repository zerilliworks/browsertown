import * as Y from 'yjs'

export default Y({
  db: {
    name: 'memory',
  },
  connector: {
    name: 'websockets-client',
    room: 'omniverse'
  }
})