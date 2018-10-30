import * as io from 'socket.io-client'
// import { URL } from 'url'
import * as url from 'url'
import PeerTable from "./peer-table"
import {LocalPeer, PeerUUID, RemotePeer} from "./peer"
import invariant from 'invariant'
import * as _ from 'lodash'
import {EventEmitter2} from "eventemitter2";

let Peer
if (typeof window !== 'undefined') {
  Peer = require('simple-peer');
}

class SocketNotConnectedError extends Error {}

export default class PeerTracker {
  private peerServerUrl: url.URL
  private socket: SocketIOClient.Socket
  private currentPlane: string | null
  private planeMetadata: Record<string, {
    id: string,
    peers: string[]
  }>
  private peerTable: PeerTable
  private localPeerInstance: LocalPeer;
  private openConnectionOffers: Record<string, {
    remoteUid: PeerUUID,
    status: "pending" | "offered" | "offer_received" | "answered" | "answer_received" | "open" | "closed",
  }>
  private events: EventEmitter2


  constructor({peerServer, localPeerInstance, debug = false}: {peerServer: string, localPeerInstance: LocalPeer, debug?: boolean}) {
    invariant(peerServer, "You must provide a peer tracker server URL when setting up the PeerTracker")
    invariant(localPeerInstance.ready, "You must provide an instance of LocalPeer when setting up the PeerTracker;" +
      " we need a reference to hold our own identity and send requests to the peer server.")

    this.localPeerInstance = localPeerInstance
    this.peerServerUrl = new URL(peerServer)
    this.peerServerUrl.search = `uid=${localPeerInstance.uid}`
    this.currentPlane = "00000000-0000-0000-0000-000000000000"
    this.planeMetadata = {}
    this.peerTable = new PeerTable(this.localPeerInstance)
    this.openConnectionOffers = {}
    this.events = new EventEmitter2()

    if(debug) {
      this.logEvents()
      this.peerTable.enableTrace()
    }
  }

  async connect() {
    // Open a connection
    this.socket = io(this.peerServerUrl.toString())

    //   ==>  Bind update listeners  <==

        // -->  Set up initial peer table from first plane update
        this.socket.once('plane_update', data => {
          // Filter out our own peer
          this.planeMetadata[data.id] = {
            ...data,
            peers: _.reject(data.peers, _.matches(this.localPeerInstance.uid))
          }

          for (let planePeer of this.planeMetadata[data.id].peers) {
            this.peerTable.plane(data.id).insert(new RemotePeer(planePeer, {direct: false}))
          }
        })

        // -->  Sync up our plane metadata when an update gets sent
        this.socket.on('plane_update', data => {
          console.debug('incoming plane_update', data)

          // Filter our own peer ID out of the metadata
          this.planeMetadata[data.id] = {
            ...data,
            peers: _.reject(data.peers, _.matches(this.localPeerInstance.uid))
          }

          this.events.emit('plane_update', this.planeMetadata)
          this.events.emit('peer_update')
        })

        // -->  Record new peers in the PeerTable when they announce themselves
        this.socket.on('peer_join', peerData => {
          console.debug('peer_join', peerData)

          // Screen out messages that tell us our own peer ID joined,
          // these are almost always erroneous
          if (peerData.peer === this.localPeerInstance.uid) {
            console.debug("(not inserting, reason: own_peer)")
            return
          }

          let peer = new RemotePeer(peerData.peer, {direct: false})
          this.peerTable.plane(peerData.plane).insert(peer)
          this.events.emit('peer_join', peer)
          this.events.emit('peer_update')
        })

        // -->  Remove peers from the PeerTable when they leave
        this.socket.on('peer_leave', peerData => {
          console.debug('peer_leave', peerData)

          // Screen out messages that tell us our own peer ID left,
          // these are almost always erroneous
          if (peerData.peer === this.localPeerInstance.uid) {
            console.debug("(not deleting, reason: own_peer)")
            return
          }

          this.peerTable.removeByUid(peerData.peer)
          this.events.emit('peer_leave', peerData)
          this.events.emit('peer_update')
        })

        // -->  Listen for incoming connection offers
        this.socket.on('connection_offer', ({from_peer, to_peer, offer}) => {
          invariant(to_peer === this.localPeerInstance.uid,
            `Incoming connection offer was addressed to a peer that isn't us!`+
            `\n${from_peer} offered connection to ${to_peer}, but we are ${this.localPeerInstance.uid}.`
          )

          console.info("Received connection offer", {from_peer, offer})

          this.openConnectionOffers[from_peer] = {remoteUid: from_peer, status: "offer_received"}

          // -> Create or update a peer record with a connection to track this pairing.
          //    Create the connection with initiator = false because the other peer started this.
          let remotePeer = this.peerTable.assertPeerConnection(from_peer, {initiator: false, trickle: false})

          // -> Take the incoming request and provide an answer
          remotePeer.signal(offer).then(answerData => {
            this.sendConnectionAnswer(from_peer, answerData)
            this.openConnectionOffers[from_peer].status = "answered"
          })

          // -> Finalize the connection once it's open
          remotePeer.once('connect', () => {
            this.openConnectionOffers[from_peer].status = "open"
            this.events.emit('peer_connected', remotePeer)
            console.info("Connected to peer", remotePeer.uid)
          })
        })


        // Listen for answers to your connection offer
        this.socket.on('connection_answer', ({from_peer, to_peer, answer}) => {
          invariant(to_peer === this.localPeerInstance.uid,
            `Incoming connection answer was addressed to a peer that isn't us!`
            + `\n${from_peer} answered connection to ${to_peer}, but we are ${this.localPeerInstance.uid}.`
          )
          invariant(
            this.openConnectionOffers[from_peer] && this.openConnectionOffers[from_peer].status === "offered",
            "No open connection offer was found for this peer's answer"
          )

          console.info("Received connection answer", {from_peer, answer})

          // -> Mark the connection record
          this.openConnectionOffers[from_peer].status = "answer_received"

          // -> Load the connection for this peer
          const remotePeer = this.peerTable.get(from_peer)
          invariant(
            remotePeer && remotePeer.connection,
            "No peer instance was allocated for answer, we probably did not offer anything to them"
          )

          // -> Signal the answer for your connection
          remotePeer.signal(answer).then(() => {})

          // -> Finalize the connection once it's open
          remotePeer.once('connect', () => {
            this.openConnectionOffers[from_peer].status = "open"
            this.events.emit('peer_connected', remotePeer)
            console.info("Connected to peer", remotePeer.uid)
          })
        })

    // Return a Promise for the connection action
    return new Promise((resolve, reject) => {
      this.socket.once('connect', resolve)
      this.socket.once('error', reject)
    })

  } /* end connect() */

  disconnect() {
    // -->  Close socket connection and clean up listeners
    this.socket.removeAllListeners()
    this.socket.close()

    // -->  Remove all event listeners
    this.events.emit('disconnect')
    this.events.removeAllListeners()

    // --> Close all peer connections
    for (let peer of this.peerTable.all()) {
      if(peer.connection) {
        peer.connection.destroy()
      }
    }
  }

  /**
   * Tell the peer tracker server that we are looking for peers in a plane
   */
  enterPlane(plane: string) {
    this.assertConnected("Socket must be open before announcing a plane")

    this.currentPlane = plane

    this.socket.emit('enter_plane', {plane})
  }

  leavePlane(plane: string) {
    this.assertConnected("Socket must be open before leaving a plane")

    this.currentPlane = null

    this.socket.emit('leave_plane', {plane})
  }

  async initiatePeerConnection(peerId: string) {

    // Note that we are making an offer to a remote peer
    this.openConnectionOffers[peerId] = {remoteUid: peerId, status: "pending"}

    // Lookup the peer instance and construct a connection object to work with
    const peer: RemotePeer = this.peerTable.assertPeerConnection(peerId, {initiator: true, trickle: false})

    // Create an offer signal and transmit it
    const offer = await peer.signal()
    this.sendConnectionOffer(peerId, offer)

    // Update our offer status
    this.openConnectionOffers[peerId].status = "offered"

    // Wait until the connection opens or errors out
    return new Promise((resolve, reject) => {
      peer.once('connect', resolve)
      peer.once('error', reject)
    })
  }

  private assertConnected(messageIfNotConnected?: string): void {
    if (this.socket == null || !this.socket.connected) { throw new SocketNotConnectedError(messageIfNotConnected) }
  }

  private sendConnectionOffer(remotePeerUid: PeerUUID, offerData: any) {
    this.socket.emit('initiate_connection', {to_peer: remotePeerUid, from_peer: this.localPeerInstance.uid, offer: offerData})
  }

  private sendConnectionAnswer(remotePeerUid: PeerUUID, answerData: any) {
    this.socket.emit('connection_answer', {to_peer: remotePeerUid, from_peer: this.localPeerInstance.uid, answer: answerData})
  }



  on(event: string, listener: (...args: any[]) => void) {
    this.events.on(event, listener)
  }

  once(event: string, listener: (...args: any[]) => void) {
    this.events.once(event, listener)
  }

  off(event: string, listener: (...args: any[]) => void) {
    this.events.off(event, listener)
  }

  getPeers(filter: {plane?: string} = {}) {
    return this.peerTable.plane(filter.plane).all()
  }



  private logEvents() {
    this.events.on('plane_update', (...args) => console.log('Emit: plane_update', ...args))
  }
}
