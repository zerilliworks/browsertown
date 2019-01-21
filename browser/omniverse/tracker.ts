import io from 'socket.io-client'
import PeerTable, {PeerTableEvent} from './peer-table'
import {LocalPeer} from './local-peer'
import invariant from 'invariant'
import _, {omit, first} from 'lodash'
import {EventEmitter2} from 'eventemitter2'
import {map, flatMap} from 'lodash'
import {Observable, Subscription, Subject, Subscribable} from 'rxjs'
import {ReactableEvent} from './reactable'
import {IPeer, PeerUUID} from './peer'
import {RemotePeer} from './remote-peer'

let Peer
if (typeof window !== 'undefined') {
  Peer = require('simple-peer')
}

type PlaneMetadataRecord = Record<string, {
  id: string,
  peers: string[]
}>

interface PeerIdentity {
  uid: PeerUUID
}

export type Tracker2Event = ReactableEvent<'peer_joined', IPeer, Tracker2>
                          | ReactableEvent<'peer_left', IPeer, Tracker2>
                          | ReactableEvent<'plane_update', PlaneMetadataRecord, Tracker2>

class Tracker2 implements Subscribable<any> {
  private identity: PeerIdentity

  private subject: Subject<Tracker2Event>
  private observable: Observable<Tracker2Event>

  constructor({peerServer, identity, plane, debug = false}: {peerServer: string, identity: PeerUUID, plane: string, debug?: boolean}) {
    // Make some assertions about our setup
    invariant(peerServer, 'You must provide a peer tracker server URL when setting up the PeerTracker')
    invariant(identity, 'You must provide an instance of LocalPeer when setting up the PeerTracker;' +
      ' we need a reference to hold our own identity and send requests to the peer server.')
    invariant(plane, 'You must provide a plane to connect to when starting the tracker')


    // Bind instance variables
    this.identity = {uid: identity}
    this.peerServerUrl = new URL(peerServer)
    this.peerServerUrl.search = `uid=${this.identity.uid}`
    this.currentPlane = plane
    this.planeMetadata = null
    this.peerTable = new PeerTable({identity: this.identity})
    this.openConnectionOffers = {}


    // Enable some extra debug info
    if(debug) {
      this.logEvents()
      this.peerTable.enableTrace()
    }
  }
}