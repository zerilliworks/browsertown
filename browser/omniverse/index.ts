import {LocalPeer, RemotePeer} from "./peer";
import PouchDB from 'pouchdb'
import {v4 as uuid} from 'uuid'
import PeerTracker from "./peer-tracker";
import {EventEmitter2} from "eventemitter2";

class PlaneScope {
  private omniverse: Omniverse;
  private planeId: string;

  constructor(planeId: string, omniverse: Omniverse) {
    this.planeId = planeId
    this.omniverse = omniverse
  }

  peers(): IPeer[] {
    return this.omniverse.peerTracker.getPeers({plane: this.planeId})
  }

  neighbors(): Array<{plane: string, peer: string}> {
    return this.omniverse.peerTracker.getNeighbors({plane: this.planeId})
  }

  broadcast(scope: string, payload: any) {
    this.peers().forEach(peer => {
      peer.sendData(scope, payload)
    })
  }
}

export default class Omniverse {
  metabase: PouchDB.Database;
  private myPeerId: string;
  private myPeerInstance: LocalPeer
  private identities: any[];
  private tracker: PeerTracker;
  private events: EventEmitter2;
  private trackerUrl: string;

  constructor({trackerUrl}: {trackerUrl: string}) {
    this.trackerUrl = trackerUrl
    this.events = new EventEmitter2({wildcard: true})
  }

  get url() { return this.trackerUrl }

  on(event: string | string[], listener: (...args: any[]) => void) {
    return this.events.on(event, listener)
  }

  many(event: string | string[], times: number, listener: (...args: any[]) => void) {
    return this.events.many(event, times, listener)
  }

  off(event: string, listener: (...args: any[]) => void) {
    return this.events.off(event, listener)
  }

  get myPeerUid() { return this.myPeerId }

  /**
   * Start up the Omniverse
   *
   * 1. Declare ourselves as a peer, resuming any identity or state
   *    we had before.
   * 2. Establish a connection to the initial peer discovery server
   * 3. Load an initial set of peers, our Local Cluster
   * 4. Connect to the Local Cluster peers
   * 5. Share our data with the Local Cluster
   */
  async boot() {
    console.info("Omniverse booting up")

    // Wake up in the world afresh, remembering who we were
    this.metabase = new PouchDB('_metabase', {adapter: 'idb'})
    console.info("Metabase loaded")

    // Find initialization data
    try {
      const bootstrapData = await this.metabase.get('peerData')
      console.info("Loaded bootstrap data", bootstrapData)
      this.myPeerId = bootstrapData.peerId
      this.identities = bootstrapData.identities
    } catch (e) {
      console.error(e)
      // Or create if it doesn't exist
      const doc = {
        _id: 'peerData',
        peerId: uuid(),
        identities: []
      }

      console.info("Generating bootstrap data", doc)
      this.metabase.put(doc)
        .then(data => console.info("Saved bootstrap data", data))
        .catch(e => console.error("Could not save bootstrap data", e))

      this.myPeerId = doc.peerId
      this.identities = doc.identities
    }

    // Create our local peer instance
    console.info("Bootstrapping local peer")
    this.myPeerInstance = new LocalPeer(this.myPeerId)

    // Start up the connection to the peer tracker
    console.info("Connecting to peer tracker")
    this.tracker = new PeerTracker({
      peerServer: this.trackerUrl,
      localPeerInstance: this.myPeerInstance,
      debug: true
    })

    // Proxy connection events
    this.tracker.on('peer_connected', peer => {
      this.events.emit('peer_connected', peer)

      // Bind the global data event to this peer
      peer.onData('*', (data, scope) => {
        this.events.emit(`peers.${peer.uid}.message.${scope}`, data, scope, peer)
      })
    })
    this.tracker.on('peer_join', peer => this.events.emit('peer_join', peer))
    this.tracker.on('peer_leave', peer => this.events.emit('peer_leave', peer))

    // Reach out to tracker server
    await this.tracker.connect()

    // Enter our initial plane
    this.tracker.enterPlane('1')
    console.info("Connected to plane 1")

    return true
  }

  plane(planeId) {
    return new PlaneScope(planeId, this)
  }

  get peerTracker() { return this.tracker }

  async connectToPeer(peer: IPeer) {
    try {
      await this.peerTracker.initiatePeerConnection(peer.uid)
      return peer
    } catch (e) {
      console.error(e)
      return false
    }
  }

  deconstruct() {
    this.tracker.disconnect()
  }
}
