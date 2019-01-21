import {IPeer, PeerRPCResponse, PeerUUID} from './peer'
import {v4 as generateUuid} from 'uuid'

export class LocalPeer implements IPeer {
  private connection?: any
  direct: boolean
  initiator: boolean
  local: boolean
  ready: boolean
  status: 'connected' | 'disconnected' | 'error' | 'connecting'
  uid: PeerUUID

  get shortUid() {
    return this.uid.split('-')[0]
  }

  constructor(uid?: string) {
    this.uid = uid || generateUuid()
    this.local = true
    this.direct = true
    this.connection = null // No need to connect to ourselves
    this.status = 'connected' // We're always connected to ourselves, obvs
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

  sendData(scope: string = '', payload: any = {}): void {
  }

  events(events: string[]): Promise<any> {
    return new Promise((resolve, reject) => reject('not implemented'))
  }

  on(event: string, handler: (...args: any[]) => void) {
  }

  once(event: string, handler: (...args: any[]) => void) {
  }

  onData(scope: string, listener: (...args: any[]) => void) {

  }

  async signal(signalData?: any) {
    return new Promise((resolve, reject) => {
      this.connection.once('error', reject)
      this.connection.once('signal', resolve)
      this.connection.signal(signalData)
    })
  }

  constructConnection(connectionOptions: object): void {
    throw new Error('constructConnection() is not valid on LocalPeer instances')
  }

  destroyConnection(): void {
    throw new Error('destroyConnection() is not valid on LocalPeer instances')
  }

  hasConnection(): boolean {
    return !!this.connection
  }

}