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
import {ReactableEvent} from './reactable'
import {Observable} from "rxjs";

interface IPeerRPCSuccessResponse {
  error: false,
  status: 'ok',
  payload: any
}

export interface IPeerRPCErrorResponse {
  error: true,
  status: 'error',
  reason: any,
  meta?: any
}

export type PeerRPCResponse = IPeerRPCSuccessResponse | IPeerRPCErrorResponse
export const NO_SCOPE = Symbol()
export type PeerUUID = string

export interface IPeer {
  // Unique ID for this peer
  uid: PeerUUID

  // Is the peer a direct peer?
  direct: boolean

  // Is this our own local peer?
  local: boolean

  // Is the peer ready to receive data?
  ready: boolean

  // What is the status of the connection to this peer?
  status: 'connected' | 'disconnected' | 'error' | 'connecting'

  // Did we initiate this peer connection?
  initiator: boolean

  // A shorter UUID to use in some cases
  shortUid: string

  // Observable stream of data events
  readonly data: Observable<PeerDataEvent> & { scope: (scope: string) => Observable<PeerDataEvent> };

  // Send a JSON payload to this peer
  sendData(plane: string, scope: string, payload: any): boolean

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
  signal(siglanData?: any): Promise<any>

  // Convenience method for filtering data events by scope
  onData(scope: string, listener: (data: any, scope: string) => void): void

  constructConnection(connectionOptions: object): void;

  destroyConnection(): void;

  hasConnection(): boolean;
}

export type IPacket = IDataPacket | IRPCRequestPacket | IRPCResponsePacket
export type IDataPacket = {
  _type: 'data'
  _version: number
  _plane: string
  _scope: string
  _payload: any
}
export type IRPCRequestPacket = {
  _type: 'rpc_request'
  _version: number
  _plane: string
  _method: string
  _args: any
  _cast: boolean
  _invocationId: string
}
export type IRPCResponsePacket = {
  _type: 'rpc_response'
  _version: number
  _plane: string
  _method: string
  _invocationId: string
  _returnValue: any
}
export type PeerEvent = PeerDataEvent | PeerRPCEvent
export type PeerDataEvent = ReactableEvent<'data', IDataPacket, IPeer>
export type PeerRPCEvent = ReactableEvent<'rpc', IRPCResponsePacket, IPeer>