import {v4 as generateUuid} from 'uuid'
import invariant from 'invariant'
import * as SimplePeer from "simple-peer";
import * as _ from 'lodash'

let Peer: SimplePeer.SimplePeer
if (typeof window !== 'undefined') {
  Peer = require('simple-peer');
}

interface IPeerRPCSuccessResponse {
  error: false,
  status: 'ok',
  payload: any
}

interface IPeerRPCErrorResponse {
  error: true,
  status: 'error',
  reason: any,
  meta?: any
}

type PeerRPCResponse = IPeerRPCSuccessResponse | IPeerRPCErrorResponse

const NO_SCOPE = Symbol()

/**
 * Data that identifies a peer and provides methods to call for sending and
 * receiving data.
 *
 * Peers may be direct or indirect, and how we connect to them depends on the
 * network. Direct peers have a WebRTC connection with us and there's no middle
 * man for data transfer. We are responsible for keeping the connection open and
 * for any data that goes through it.
 *
 * Indirect peers are members of the same Peer group as we are, but we don't have
 * a WebRTC connection to them. In this case, we have to find a path through the
 * graph of peers to the peer we want to send messages to and then ask our neighbors
 * to forward our packets along.
 *
 * To connect directly to a peer, we can discover its UID via the gossip network
 * or from a peer tracker server. Then you must signal the peer via a signalling
 * channel in order to connect directly. The tracker server can exchange signals
 * to set up connections, or you can forward signal data through peers you're
 * already connected to.
 *
 * The IPeer interface describes a single node in the larger peer network. Many
 * IPeer instances are kept within the PeerTable.
 */
export type PeerUUID = string

export interface IPeer {
  // Unique ID for this peer
  uid: PeerUUID

  // A WebRTC connection, as handled by Simple Peer (only if a direct peer)
  connection?: any

  // Is the peer a direct peer?
  direct: boolean

  // Is this our own local peer?
  local: boolean

  // Is the peer ready to receive data?
  ready: boolean

  // What is the status of the connection to this peer?
  status: "connected" | "disconnected" | "error" | "connecting"

  // Did we initiate this peer connection?
  initiator: boolean

  // Send a JSON payload to this peer
  sendData(scope: string, payload: any): void

  // Send an RPC call to this peer (response required)
  sendCall(method: string, payload: any): Promise<PeerRPCResponse>

  // Send an RPC cast to this peer (no response expected)
  sendCast(method: string, payload: any): void

  // Handle an event
  on(event: string, handler: (...args: any[]) => void): void

  // Handle an event one time
  once(event: string, handler: (...args: any[]) => void): void

  // Async version of once()
  events(events: string[]): Promise<any>

  // Convenience method for awaiting signal data
  signal(siglanData: any): Promise<any>

  // Convenience method for filtering data events by scope
  onData(scope: string, listener: (...args: any[]) => void): void

  constructConnection(connectionOptions: object): void;
}


export class RemotePeer implements IPeer {
  connection?: any;
  direct: boolean;
  local: boolean;
  initiator: boolean;
  ready: boolean;
  status: "connected" | "disconnected" | "error" | "connecting";
  uid: PeerUUID;

  constructor(uid: string, options: { direct: boolean }) {
    invariant(uid, "You must provide a UID when setting up remote peers")

    this.uid = uid
    this.status = "disconnected"
    this.local = false
    this.direct = options.direct
    this.ready = false
    this.initiator = false
  }

  async sendCall(method: string, payload: any): Promise<PeerRPCResponse> {
    return new Promise((resolve: (r: PeerRPCResponse) => void) => resolve({
      status: 'error',
      error: true,
      reason: 'rpc_not_implemented'
    }))
  }

  sendCast(method: string, payload: any): void {
  }

  sendData(scope: string = "", payload: any = {}): void {
    this.connection.send(JSON.stringify({_scope: scope, _payload: payload}))
  }

  on(event: string, handler: (...args: any[]) => void) {
    return this.connection.on(event, handler)
  }

  once(event: string, handler: (...args: any[]) => void) {
    return this.connection.once(event, handler)
  }

  onData(scope: string, listener: (data: any) => void): void {
    this.connection.on('data', (rawData: Uint8Array) => {
      let data: object = JSON.parse(rawData.toString())
      if (_.get(data, '_scope', NO_SCOPE) === scope) {
        listener((data as {_scope: string, _payload: any})._payload)
      }
    })
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
  }
}

export class LocalPeer implements IPeer {
  connection?: any;
  direct: boolean;
  initiator: boolean;
  local: boolean;
  ready: boolean;
  status: "connected" | "disconnected" | "error" | "connecting";
  uid: PeerUUID;

  constructor(uid?: string) {
    this.uid = uid || generateUuid()
    this.local = true
    this.direct = true
    this.connection = null // No need to connect to ourselves
    this.status = "connected" // We're always connected to ourselves, obvs
    this.ready = true
    this.initiator = false
  }

  sendCall(method: string, payload: any): Promise<PeerRPCResponse> {
    return new Promise((resolve: (r: PeerRPCResponse) => void) => resolve({
      status: 'error',
      error: true,
      reason: 'rpc_not_implemented'
    }))
  }

  sendCast(method: string, payload: any): void {
  }

  sendData(scope: string = "", payload: any = {}): void {
  }

  events(events: string[]): Promise<any> {
    return new Promise((resolve, reject) => reject("not implemented"))
  }

  on(event: string, handler: (...args: any[]) => void) {
  }

  once(event: string, handler: (...args: any[]) => void) {
  }

  onData(scope: string, listener: (...args: any[]) => void) {

  }

  async signal(signalData: any) {
    return new Promise((resolve, reject) => {
      this.connection.once('error', reject)
      this.connection.once('signal', resolve)
      this.connection.signal(signalData)
    })
  }

  constructConnection(connectionOptions: object): void {
    throw new Error("constructConnection() is not valid on LocalPeer instances")
  }

}
