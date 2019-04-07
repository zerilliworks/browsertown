import io from 'socket.io-client'
// import { URL } from 'url'
import PeerTable from './peer-table'
import {LocalPeer} from './local-peer'
import invariant from 'invariant'
import _, {omit, first} from 'lodash'
import {EventEmitter2} from 'eventemitter2'
import {map, flatMap} from 'lodash'
import {Observable, Subscription, Subject, merge} from 'rxjs'
import {IPeer, PeerDataEvent, PeerEvent, PeerUUID} from './peer'
import {RemotePeer} from './remote-peer'
import {filter} from "rxjs/operators";

let Peer
if (typeof window !== 'undefined') {
  Peer = require('simple-peer')
}

class SocketNotConnectedError extends Error {}

type PlaneDataPayload = {
  peers: string[]
  id: string,
  origin: [number, number]
}


type PlaneMetadataRecord = Record<string, {
  id: string,
  peers: string[]
}>

export type PeerConnectedEvent = {
  eventName: 'peer_connected',
  listener: (peer: IPeer) => void
}

export type PeerUpdateEvent = {
  eventName: 'peer_update',
  listener: () => void
}

export type PeerJoinEvent = {
  eventName: 'peer_join',
  listener: (peer: IPeer) => void
}

export type PeerLeaveEvent = {
  eventName: 'peer_leave',
  listener: (peer: {peer: PeerUUID, plane: string}) => void
}

export type PlaneUpdateEvent = {
  eventName: 'plane_update',
  listener: (planeData: PlaneMetadataRecord) => void
}

export type ConnectEvent = {
  eventName: 'connect',
  listener: () => void
}

export type DisconnectEvent = {
  eventName: 'disconnect',
  listener: () => void
}


export default class PeerTracker {
  private peerServerUrl: URL
  private socket?: SocketIOClient.Socket
  private currentPlane: string | null
  private planeMetadata: PlaneMetadataRecord
  private peerTable: PeerTable
  private localPeerInstance: LocalPeer
  private openConnectionOffers: Record<string, {
    remoteUid: PeerUUID,
    status: 'pending' | 'offered' | 'offer_received' | 'answered' | 'answer_received' | 'open' | 'closed',
  }>
  private events: EventEmitter2

  constructor({peerServer, localPeerInstance, debug = false}: {peerServer: string, localPeerInstance: LocalPeer, debug?: boolean}) {
    // Make some assertions about our setup
    invariant(peerServer, 'You must provide a peer tracker server URL when setting up the PeerTracker')
    invariant(localPeerInstance.ready, 'You must provide an instance of LocalPeer when setting up the PeerTracker;' +
      ' we need a reference to hold our own identity and send requests to the peer server.')


    // Bind instance variables
    this.localPeerInstance = localPeerInstance
    this.peerServerUrl = new URL(peerServer)
    this.peerServerUrl.search = `uid=${localPeerInstance.uid}`
    this.currentPlane = '00000000-0000-0000-0000-000000000000'
    this.planeMetadata = {}
    this.peerTable = new PeerTable(this.localPeerInstance)
    this.openConnectionOffers = {}
    this.events = new EventEmitter2()

    // Set up the proxy to Observables
    this.events.onAny((event, ...args) => {

    })

    // Enable some extra debug info
    if(debug) {
      this.logEvents()
      this.peerTable.enableTrace()
    }
  }

  async connect() {
    // Open a connection
    this.socket = io(this.peerServerUrl.toString(), {path: '/peer'})

    this.events.emit('connect')

    //   ==>  Bind connection status listeners  <==
    ;[
      'connect',
      'connect_error',
      'connect_timeout',
      'disconnect',
      'reconnect',
      'reconnect_attempt',
      'reconnect_error',
      'reconnect_failed'
    ].map(event => {
      // @ts-ignore
      this.socket.on(event, (...args) => this.events.emit(event, ...args))
    })

    this.socket.on('reconnect', () => {
      if (this.currentPlane) {
        // It's sort of dopey that we have to do this, but Socket.io doesn't immediately
        // mark the socket as open on the 'reconnect' event. It does for the 'connect'
        // event, but we don't necessarily want to fire this on first connection.
        // @ts-ignore
        setImmediate(() => this.enterPlane(this.currentPlane))
      }
    })

    //   ==>  Bind update listeners  <==

    // --> Reply to roll_call requests from the server
    this.socket.on('roll_call', ({newbie, plane}: {newbie: PeerUUID, plane: string}) => {
      console.log("Received roll call with data", {newbie, plane})
      this.socket.emit('announce', {fromPeer: this.localPeerInstance.uid, plane})
    })


    // --> Handle incoming peer announcements
    this.socket.on('announce', ({fromPeer, plane}: {fromPeer: PeerUUID, plane: string}) => {
      console.log("Peer announced", fromPeer, plane)
      this.peerTable.plane(plane).register(fromPeer)
      const peer = this.peerTable.plane(plane).get(fromPeer)
      this.events.emit('peer_announce', peer)
      this.events.emit('peer_update')
    })


    // -->  Remove peers from the PeerTable when they leave
    this.socket.on('peer_leave', (peerData: {peer: PeerUUID, plane: string}) => {
      console.debug('peer_leave', peerData)

      // Screen out messages that tell us our own peer ID left,
      // these are almost always erroneous
      if (peerData.peer === this.localPeerInstance.uid) {
        console.debug('(not deleting, reason: own_peer)')
        return
      }

      // this.openConnectionOffers[peerData.peer] = undefined
      let p = this.peerTable.plane(peerData.plane).get(peerData.peer)
      p && p.destroyConnection()
      _.remove(this.planeMetadata[peerData.plane].peers, peerData.peer)
      this.peerTable.plane(peerData.plane).removeByUid(peerData.peer)
      this.events.emit('peer_leave', peerData)
      this.events.emit('peer_update')
    })

    // -->  Listen for incoming connection offers
    this.socket.on('connection_offer', ({from_peer, to_peer, offer}: {from_peer: PeerUUID, to_peer: PeerUUID, offer: any}) => {
      invariant(to_peer === this.localPeerInstance.uid,
        `Incoming connection offer was addressed to a peer that isn't us!`+
        `\n${from_peer} offered connection to ${to_peer}, but we are ${this.localPeerInstance.uid}.`
      )

      console.info('Received connection offer', {from_peer, offer})
      console.debug(this.openConnectionOffers)

      if (!this.openConnectionOffers[from_peer]) {
        // Set up a new ledger entry for this offer we just got
        this.openConnectionOffers[from_peer] = {remoteUid: from_peer, status: 'offer_received'}
      }
      else {
        // We already have a known connection here! Either it's open already, or we were mid-
        // handshake and got interrupted. Either way, obliterate and start over.
        switch (this.openConnectionOffers[from_peer].status) {
          case 'open':
            // Destroy the open connection and start anew. This often happens
            // when a peer reloads or crashes and rejoins quickly.
            console.log("Re-opening connection")
            this.peerTable.plane(this.currentPlane).disconnectFromPeer(from_peer)
            this.openConnectionOffers[from_peer] = {remoteUid: from_peer, status: 'offer_received'}
            break
          default: break
        }
      }


      // -> Create or update a peer record with a connection to track this pairing.
      //    Create the connection with initiator = false because the other peer started this.
      let remotePeer = this.peerTable.plane(this.currentPlane).assertPeerConnection(from_peer, {initiator: false, trickle: false})

      // -> Take the incoming request and provide an answer
      remotePeer.signal(offer).then((answerData: any) => {
        this.sendConnectionAnswer(from_peer, answerData)
        this.openConnectionOffers[from_peer].status = 'answered'
      })

      // -> Finalize the connection once it's open
      remotePeer.once('connect', () => {
        this.openConnectionOffers[from_peer].status = 'open'
        this.events.emit('peer_connected', remotePeer)
        console.info('Connected to peer', remotePeer.uid)
      })
    })


    // Listen for answers to your connection offer
    this.socket.on('connection_answer', ({from_peer, to_peer, answer}: {from_peer: PeerUUID, to_peer: PeerUUID, answer: any}) => {
      invariant(to_peer === this.localPeerInstance.uid,
        `Incoming connection answer was addressed to a peer that isn't us!`
        + `\n${from_peer} answered connection to ${to_peer}, but we are ${this.localPeerInstance.uid}.`
      )
      invariant(
        this.openConnectionOffers[from_peer] && this.openConnectionOffers[from_peer].status === 'offered',
        'No open connection offer was found for this peer\'s answer'
      )

      console.info('Received connection answer', {from_peer, answer})

      // -> Mark the connection record
      this.openConnectionOffers[from_peer].status = 'answer_received'

      // -> Load the connection for this peer
      const remotePeer = this.peerTable.get(from_peer)
      invariant(
        remotePeer && remotePeer.hasConnection(),
        'No peer instance was allocated for answer, we probably did not offer anything to them'
      )
      if (!remotePeer) { throw 'no peer' }

      // -> Signal the answer for your connection
      remotePeer.signal(answer).then(() => {})

      // -> Finalize the connection once it's open
      remotePeer.once('connect', () => {
        this.openConnectionOffers[from_peer].status = 'open'

        // Bind

        this.events.emit('peer_connected', remotePeer)
        console.info('Connected to peer', remotePeer.uid)
      })
    })

    // Return a Promise for the connection action
    return new Promise((resolve, reject) => {
      if (!this.socket) { return reject(new Error ('Socket wasn\'t intialized correctly')) }
      this.socket.once('connect', resolve)
      this.socket.once('error', reject)
    })

  } /* end connect() */

  disconnect() {
    if (!this.socket) { return }

    // -->  Close socket connection and clean up listeners
    this.socket.removeAllListeners()
    this.socket.close()

    // -->  Remove all event listeners
    this.events.emit('disconnect')
    this.events.removeAllListeners()

    // --> Close all peer connections
    for (let peer of this.peerTable.all()) {
      peer.destroyConnection()
    }
  }

  /**
   * Tell the peer tracker server that we are looking for peers in a plane
   */
  enterPlane(plane: string) {
    if (!this.socket) { return }

    this.assertConnected('Socket must be open before announcing a plane')

    this.currentPlane = plane

    this.socket.emit('enter_plane', {plane_id: plane}, (response: any) => {
      if (response !== 'error') {
        this.planeMetadata[plane] = response
      }
    })
  }

  leavePlane(plane: string) {
    if (!this.socket) { return }

    this.assertConnected('Socket must be open before leaving a plane')

    this.currentPlane = null

    this.socket.emit('leave_plane', {plane_id: plane})
  }

  async initiatePeerConnection(peerId: string) {

    console.log("Peer connection initiating to " + peerId)

    // Check first that we don't already have an open connection
    let existingPeer = this.peerTable.get(peerId)
    console.log(existingPeer)
    if (existingPeer && existingPeer.ready == true) {
      // Destroy the connection and reset offer
      console.log('resetting offer')
      existingPeer.destroyConnection()
      delete this.openConnectionOffers[peerId]
    }

    console.log(this.openConnectionOffers)

    // See if an offer is already in progress
    if (this.openConnectionOffers[peerId]) {

      // If we offered but they also offered, cancel our offer if we are lower
      console.log("Peer connection already initiated to " + peerId)
      return Promise.reject('Peer connection already initiated')
    }

    // Note that we are making an offer to a remote peer
    this.openConnectionOffers[peerId] = {remoteUid: peerId, status: 'pending'}

    // Lookup the peer instance and construct a connection object to work with
    const peer: IPeer = this.peerTable.assertPeerConnection(peerId, {initiator: true, trickle: false})

    // Create an offer signal and transmit it
    const offer = await peer.signal()
    console.log("Sending connection offer to " + peerId)
    this.sendConnectionOffer(peerId, offer)

    // Update our offer status
    this.openConnectionOffers[peerId].status = 'offered'

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
    if (!this.socket) { throw 'No socket!' }
    this.socket.emit('initiate_connection', {to_peer: remotePeerUid, from_peer: this.localPeerInstance.uid, offer: offerData})
  }

  private sendConnectionAnswer(remotePeerUid: PeerUUID, answerData: any) {
    if (!this.socket) { throw 'No socket!' }
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
    if (filter.plane) {
      return this.peerTable.plane(filter.plane).all()
    }
    else {
      return this.peerTable.all()
    }
  }

  getPeer(filter: {plane?: string, uid?: string} = {}) {
    if (filter.plane) {
      return first(this.peerTable.plane(filter.plane).find(omit(filter, 'plane')))
    }
    else {
      return first(this.peerTable.find(omit(filter, 'plane')))
    }
  }

  getNeighbors(filter: {plane?: string} = {}) {
    if(filter.plane) {
      return map(this.planeMetadata[filter.plane].peers, peer => ({plane: filter.plane, peer}))
    }
    else {
      return flatMap(this.planeMetadata, ({id, peers}) => map(peers, p => ({plane: id, peer: p})))
    }
  }



  private logEvents() {
    this.events.on('plane_update', (...args) => console.log('Emit: plane_update', ...args))
  }

  get connectionOffers() {
    return this.openConnectionOffers
  }
}
