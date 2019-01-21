import {LocalPeer} from './local-peer'
import {values, filter, map, matches} from 'lodash'
// @ts-ignore
import * as graphlib from '@dagrejs/graphlib'
import invariant from 'invariant'
import {Observable, Observer, PartialObserver, Subject, Subscribable, Unsubscribable} from 'rxjs'
import {filter as rx_filter} from 'rxjs/operators'
import {ReactableEvent} from './reactable'
import {IPeer, PeerUUID} from './peer'
import {RemotePeer} from './remote-peer'

export interface IPeerTableRecord {
  peer: IPeer,
  plane: string
}

export type PeerTableEvent = ReactableEvent<'peer_added', IPeer, PeerTable>
                           | ReactableEvent<'peer_removed', string, PeerTable>
                           | ReactableEvent<'peers_associated', [PeerUUID, PeerUUID], PeerTable>
                           | ReactableEvent<'peers_dissociated', [PeerUUID, PeerUUID], PeerTable>


export default class PeerTable implements Subscribable<PeerTableEvent> {
  private readonly peerTable: Record<string, IPeerTableRecord>
  private peerGraph: any
  // We hold a local peer reference here so we can distinguish it
  private localPeer: IPeer
  planeSelector?: string
  private traceEnabled: boolean
  private subject: Subject<PeerTableEvent>
  private observable: Observable<PeerTableEvent>

  constructor(localPeer: LocalPeer, options: { trace?: boolean } = {trace: false}) {
    this.localPeer = localPeer
    this.peerTable = {}
    this.peerGraph = new graphlib.Graph({directed: false})
    this.traceEnabled = options.trace || false
    this.subject = new Subject()
    this.observable = this.subject.asObservable()
  }

  plane(planeId: string) {
    let proxy: PeerTable = Object.create(this)
    proxy.planeSelector = planeId
    return proxy
  }

  register(id: PeerUUID): boolean {
    // If the peer is know to us already, don't re-register
    if (this.get(id)) {
      return false
    }

    // New up a RemotePeer and insert it
    let peerInstance = new RemotePeer(id, {direct: false})
    this.insert(peerInstance) // Insert, respecting contextual plane selection

    return true
  }

  insert(peer: IPeer): boolean {
    invariant(this.planeSelector, 'You must select a plane when inserting peers: be sure to chain plane(...) call to set plane selector.')

    this.trace(() => {
      console.debug('Inserting peer', {plane: this.planeSelector, peer})
      console.trace()
    })

    this.peerTable[peer.uid] = {
      peer: peer,
      plane: this.planeSelector as string
    }
    this.peerGraph.setNode(peer.uid)

    this.subject.next({event: 'peer_added', payload: peer, instance: this})

    return true
  }

  get(uid: PeerUUID): IPeer | null {
    let p = this.peerTable[uid]
    return p ? p.peer : null
  }

  find(predicate: any) {
    return filter(this.all(), predicate)
  }

  all(): IPeer[] {
    if (this.planeSelector) {
      return map(filter(values(this.peerTable), {plane: this.planeSelector}), 'peer')
    }
    else {
      return map(values(this.peerTable), 'peer')
    }
  }

  remove(peer: IPeer): void {
    this.trace(() => {
      console.debug('Deleting peer', {plane: this.planeSelector, peer})
      console.trace()
    })

    delete this.peerTable[peer.uid]

    this.subject.next({event: 'peer_removed', payload: peer.uid, instance: this})
  }

  removeByUid(uid: PeerUUID): void {
    this.trace(() => {
      console.debug('Deleting peer UUID', {plane: this.planeSelector, peer: uid})
      console.trace()
    })

    delete this.peerTable[uid]

    this.subject.next({event: 'peer_removed', payload: uid, instance: this})
  }

  associate(peerA: PeerUUID, peerB: PeerUUID) {
    this.peerGraph.setEdge(peerA, peerB)
    this.subject.next({event: 'peers_associated', payload: [peerA, peerB], instance: this})
  }

  dissociate(peerA: PeerUUID, peerB: PeerUUID) {
    this.peerGraph.removeEdge(peerA, peerB)
    this.subject.next({event: 'peers_dissociated', payload: [peerA, peerB], instance: this})
  }

  /**
   * Assert a Peer connection object into assistance.
   *
   * If the peer indicated by peerUid isn't in the peer table, we create a RemotePeer
   * instance and construct a connection.
   *
   * If the peer exists, construct a connection for it.
   *
   * If the peer exists and already has a connection, do nothing.
   *
   * In each case, returns a RemotePeer with a Connection set up.
   * @param peerUid
   * @param connectionOptions
   */
  assertPeerConnection(peerUid: PeerUUID, connectionOptions: object = {}): IPeer {
    let peer = this.get(peerUid)

    if (!peer) {
      peer = new RemotePeer(peerUid, {direct: true})
      this.insert(peer)
    }

    if (!peer.hasConnection()) {
      peer.constructConnection(connectionOptions)
    }

    return peer
  }

  disconnectFromPeer(peerUid: PeerUUID, options: object = {}): boolean {
    let peer = this.get(peerUid)

    if (peer && peer.hasConnection()) {
      peer.destroyConnection()
      return true
    }
    else {
      return false
    }
  }

  private trace(effect: () => void) {
    if (this.traceEnabled) {
      effect()
    }
  }

  enableTrace() {
    this.traceEnabled = true
  }

  disableTrace() {
    this.traceEnabled = false
  }

  subscribe(...args: any[]) {
    return this.observable.subscribe(...args)
  }

  on(event: string, listener: (...args: any[]) => void) {
    return this.observable.pipe(rx_filter(matches({event}))).subscribe(listener)
  }
}
