import {IPeer, LocalPeer, PeerUUID, RemotePeer} from "./peer";
import {values, filter, map} from 'lodash'
// @ts-ignore
import * as graphlib from '@dagrejs/graphlib'
import invariant from 'invariant'

export interface IPeerTableRecord {
  peer: IPeer,
  plane: string
}

export default class PeerTable {
  private readonly peerTable: Record<string, IPeerTableRecord>;
  private peerGraph: any;
  // We hold a local peer reference here so we can distinguish it
  private localPeer: IPeer;
  planeSelector?: string;
  private traceEnabled: boolean

  constructor(localPeer: LocalPeer, options: {trace?: boolean} = {trace: false}) {
    this.localPeer = localPeer
    this.peerTable = {}
    this.peerGraph = new graphlib.Graph({directed: false})
    this.traceEnabled = options.trace || false
  }

  plane(planeId: string) {
    let proxy: PeerTable = Object.create(this)
    proxy.planeSelector = planeId
    return proxy
  }

  insert(peer: IPeer): boolean {
    invariant(this.planeSelector, "You must select a plane when inserting peers: be sure to chain plane(...) call to set plane selector.")

    this.trace(() => {
      console.debug("Inserting peer", {plane: this.planeSelector, peer})
      console.trace()
    })

    this.peerTable[peer.uid] = {
      peer: peer,
      plane: this.planeSelector as string
    }
    this.peerGraph.setNode(peer.uid)

    return true
  }

  get(uid: PeerUUID): IPeer | null {
    let p = this.peerTable[uid]
    return p ? p.peer : null
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
      console.debug("Deleting peer", {plane: this.planeSelector, peer})
      console.trace()
    })

    delete this.peerTable[peer.uid]
  }

  removeByUid(uid: PeerUUID): void {
    this.trace(() => {
      console.debug("Deleting peer UUID", {plane: this.planeSelector, peer: uid})
      console.trace()
    })

    delete this.peerTable[uid]
  }

  associate(peerA: PeerUUID, peerB: PeerUUID) {
    this.peerGraph.setEdge(peerA, peerB)
  }

  dissociate(peerA: PeerUUID, peerB: PeerUUID) {
    this.peerGraph.removeEdge(peerA, peerB)
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
}
