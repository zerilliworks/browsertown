import * as SimplePeer from 'simple-peer'
import {
  IDataPacket,
  IPacket,
  IPeer,
  IPeerRPCErrorResponse,
  IRPCRequestPacket,
  IRPCResponsePacket,
  NO_SCOPE,
  PeerRPCResponse,
  PeerUUID
} from './peer'
import {Subject, Subscribable} from 'rxjs'
import {EventEmitter2} from 'eventemitter2'
import {v4 as uuid} from 'uuid'
import timeout from '../utility/timeout'
import * as _ from 'lodash'
import invariant from 'invariant'

export let Peer: SimplePeer.SimplePeer
if (typeof window !== 'undefined') {
  Peer = require('simple-peer')
}

export class RemotePeer implements IPeer, Subscribable<any> {
  private connection?: any
  private readonly dataEvents: EventEmitter2
  private readonly rpcEvents: EventEmitter2

  direct: boolean
  local: boolean
  initiator: boolean
  ready: boolean
  status: 'connected' | 'disconnected' | 'error' | 'connecting'
  uid: PeerUUID
  private subject: Subject<any>
  private observable: any

  get shortUid() {
    return this.uid.split('-')[0]
  }

  constructor(uid: string, options: { direct: boolean }) {
    invariant(uid, 'You must provide a UID when setting up remote peers')

    this.uid = uid
    this.status = 'disconnected'
    this.local = false
    this.direct = options.direct
    this.ready = false
    this.initiator = false

    this.dataEvents = new EventEmitter2({wildcard: true})
    this.rpcEvents = new EventEmitter2({wildcard: true})

    this.subject = new Subject()
    this.observable = this.subject.asObservable()

    // this.dataEvents.onAny((...args) => {
    //   console.debug('Incoming data packet', args)
    // })
  }

  async sendCall(method: string, payload: any): Promise<PeerRPCResponse> {
    return this.sendRPC(method, payload, true, 10000)
  }

  sendCast(method: string, payload: any): void {
    this.sendRPC(method, payload, false, 10000)
  }

  sendData(scope: string = '', payload: any = {}): boolean {
    if (!this.connection || !this.connection.writable) {
      return false
    }

    try {
      this.connection.send(JSON.stringify({
        _type: 'data',
        _version: 1,
        _scope: scope,
        _payload: payload
      } as IDataPacket))
      return true
    } catch (e) {
      console.error('Failed to send to peer', this, e)
      return false
    }
  }

  sendRPC(method: string, args: any, responseRequired: boolean, timeoutDelay: number = 10000) {
    let taskPromise = new Promise<PeerRPCResponse>((resolve: (r: PeerRPCResponse) => void) => {
      if (!this.connection || !this.connection.writable) {
        return {
          status: 'error',
          error: true,
          reason: 'no_connection',
        }
      }

      const invocationId = uuid()

      try {
        this.connection.send(JSON.stringify({
          _type: 'rpc_request',
          _version: 1,
          _method: method,
          _args: args,
          _cast: responseRequired,
          _invocationId: invocationId
        } as IRPCRequestPacket))
        return true
      } catch (e) {
        console.error('Failed to call procedure at peer', this, e)
        return false
      }
    })

    let to = timeout<IPeerRPCErrorResponse>(timeoutDelay, {
      status: 'error',
      error: true,
      reason: 'timeout',
      meta: {after: 10000}
    })

    return Promise.race([to, taskPromise])
  }

  on(event: string, handler: (...args: any[]) => void) {
    return this.connection.on(event, handler)
  }

  once(event: string, handler: (...args: any[]) => void) {
    return this.connection.once(event, handler)
  }

  onData(scope: string, listener: (data: any, scope?: any) => void): void {
    console.log('Add data listener', scope, listener.toString())
    if (scope === '*') {
      this.dataEvents.onAny((scope: string | string[], data: any[]) => {
        listener(data, scope)
      })
    } else {
      this.dataEvents.on(scope, listener)
    }
  }

  async events(events: string[]) {
    return new Promise((resolve, reject) => {
      this.connection.once('error', reject)
      for (let event of events) {
        this.connection.once(event, resolve)
      }
    })
  }

  async signal(signalData?: any) {
    return new Promise((resolve, reject) => {
      this.connection.once('error', reject)
      this.connection.once('signal', resolve)
      signalData && this.connection.signal(signalData)
    })
  }

  constructConnection(connectionOptions: object = {}): void {
    this.connection = new Peer(connectionOptions)
    this.direct = true

    this.connection.once('connect', () => {
      this.ready = true
      this.status = 'connected'
    })

    this.bindConnectionDataEvents()
  }

  /**
   * Bind a listener to the core conn object, which dispatches to other more granular
   * handlers as needed. The 'data' event on the connection object receives payloads
   * for all types of peer communications, so they are parsed and validated here,
   * then routed to the correct handler method on the peer class.
   */
  private bindConnectionDataEvents() {
    this.connection.on('data', (rawData: Uint8Array) => {
      let packet: IPacket
      try {
        packet = JSON.parse(rawData.toString())
      } catch (e) {
        console.error('Could not parse raw packet data', rawData)
        return
      }

      // Helper for reporting errors
      const invalid = (reason: string) => console.error('Invalid packet received (' + reason + ')', packet)

      if (!packet._type || !packet._version) {
        return invalid('missing packet description fields')
      }

      if (packet._version !== 1) {
        return invalid('bad packet version')
      }

      switch (packet._type) {
        case 'data': // Received a data packet from this peer
          packet = packet as IDataPacket
          if (typeof packet._payload === 'undefined' || typeof packet._scope === 'undefined') {
            return invalid('missing data fields')
          }
          this.handleDataPacket(packet)
          break

        case 'rpc_request': // Received an RPC request packet from this peer
          packet = packet as IRPCRequestPacket
          if (typeof packet._method === 'undefined' || packet._invocationId === 'undefined' || typeof packet._args === 'undefined') {
            return invalid('missing RPC request fields')
          }
          this.handleRPCRequestPacket(packet)
          break

        case 'rpc_response': // Received an RPC response packet from this peer
          packet = packet as IRPCResponsePacket
          if (packet._method === 'undefined' || typeof packet._invocationId === 'undefined' || typeof packet._returnValue === 'undefined') {
            return invalid('missing RPC response fields')
          }
          this.handleRPCResponsePacket(packet)
          break

        default:
          return invalid('unknown packet type')
      }
    })
  }

  private handleDataPacket(packet: IDataPacket) {
    let scope
    if ((scope = _.get(packet, '_scope', NO_SCOPE)) !== NO_SCOPE) {
      let {_scope, _payload} = packet
      this.dataEvents.emit(scope, _payload, _scope)
    }
  }

  /**
   * Handle an incoming RPC request packet from this peer. Dispatch to correct
   * handler method, and emit an IPeerRPCResponse back to the sender.
   * @param packet
   */
  private handleRPCRequestPacket(packet: IRPCRequestPacket) {
    switch (packet._method) {
      case 'ping':

    }
  }

  private handleRPCResponsePacket(packet: IRPCResponsePacket) {
    this.rpcEvents.emit(`${packet._method}.${packet._invocationId}`, packet._returnValue)
  }

  destroyConnection(): void {
    if (this.connection) {
      this.connection.removeAllListeners()
      this.connection.destroy()
      this.ready = false
      this.status = 'disconnected'
      delete this.connection
    }
  }

  hasConnection(): boolean {
    return !!this.connection
  }

  subscribe(...args: any[]) {
    return this.observable.subscribe(...args)
  }
}