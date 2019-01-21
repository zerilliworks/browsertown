import coreTest, {TestInterface, Macro} from "ava";
import axios, {AxiosError, AxiosInstance} from 'axios'
import {startServer, http} from '../server'
import io from 'socket.io-client'
import Socket = SocketIOClient.Socket;

interface Context {serverUrl: string, serverPort: number, axios: AxiosInstance, socket: Socket}

const test = coreTest as TestInterface<Context>

test.before('start a server instance to test', t => {
  return new Promise((resolve, reject) => {
    let server = startServer()

    server.once('listening', () => {
      t.context.serverUrl = `http://localhost:${server.address().port}`
      t.context.serverPort = server.address().port
      t.context.axios = axios.create({baseURL: t.context.serverUrl})
      resolve()
    })
  })
})

test.beforeEach('create a socket connection', t => {
  t.context.socket = io(t.context.serverUrl, {forceNew: true, path: '/peer'})
})

test.afterEach('disconnect from socket', t => {
  t.context.socket.close()
})

test.after.always('cleanup server instance', () => {
  http.close()
})

// Tests themselves

test.cb('can connect to socket', (t) => {
  t.context.socket.emit('heartbeat', 'lub', (re: string) => {
    t.is(re, 'dub')
    t.end()
  })
})
