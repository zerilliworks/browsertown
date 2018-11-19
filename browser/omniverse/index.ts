import {IPeer, LocalPeer, PeerUUID, RemotePeer} from './peer'
import PouchDB from 'pouchdb'
import {v4 as uuid} from 'uuid'
import PeerTracker from "./peer-tracker";
import {EventEmitter2} from "eventemitter2";
import {defaults} from 'lodash'

class PlaneScope {
  private omniverse: Omniverse;
  private planeId: string;

  constructor(planeId: string, omniverse: Omniverse) {
    this.planeId = planeId
    this.omniverse = omniverse
  }

  peers(): IPeer[] {
    if (!this.omniverse.peerTracker) { return [] }
    return this.omniverse.peerTracker.getPeers({plane: this.planeId})
  }

  neighbors(): Array<{plane: string | undefined, peer: string}> {
    if (!this.omniverse.peerTracker) { return [] }
    return this.omniverse.peerTracker.getNeighbors({plane: this.planeId})
  }

  broadcast(scope: string, payload: any) {
    let res = this.peers().map(peer => {
      return peer.sendData(scope, payload)
    })
    console.log('broadcasting', scope, payload, res)
  }
}

interface OmniverseOptions {
  autoPeer: boolean
  trackerUrl: string
}

export default class Omniverse {
  // @ts-ignore
  metabase: PouchDB.Database;
  readonly options: OmniverseOptions;
  private myPeerId?: string;
  private myPeerInstance?: LocalPeer
  private identities?: any[];
  private tracker?: PeerTracker;
  private events: EventEmitter2;
  private selectedPlane: string | null
  private autoPeer: boolean
  private debug: boolean
  private readonly trackerUrl: string;

  private static readonly defaultOptions = {
    autoPeer: true,
  }

  constructor(options: { trackerUrl: string; autoPeer: boolean; plane?: string; debug?: boolean}) {
    this.options = options
    let {trackerUrl, autoPeer, plane} = defaults(options, Omniverse.defaultOptions)
    this.autoPeer = autoPeer
    this.trackerUrl = trackerUrl
    this.events = new EventEmitter2({wildcard: true})
    this.selectedPlane = plane || null
    this.debug = !!options.debug
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

  offAll(event: string) {
    return this.events.removeAllListeners(event)
  }

  get myPeerUid() { return this.myPeerId }

  /**
   * Scope helper, so API users don't have to glue strings together all the time
   * @param segments
   */
  scope(...segments: (string | number)[]) {
    return segments.join('.')
  }

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
  async boot(): Promise<boolean> {
    console.info("Omniverse booting up")

    // Wake up in the world afresh, remembering who we were
    this.metabase = new PouchDB('_metabase', {adapter: 'idb'})

    // Find initialization data
    try {
      const bootstrapData: {peerId: string, identities: any[]} = await this.metabase.get('peerData') as unknown as {peerId: string, identities: any[]}
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
      debug: this.debug
    })

    // Proxy connection events
    this.tracker.on('peer_connected', peer => {
      this.events.emit('peer_connected', peer)

      // Bind the global data event to this peer
      peer.onData('*', (data: any, scope: string) => {
        console.debug('Incoming peer broadcast', data, scope, peer.uid)
        console.debug('Re-emitted as', `peers.${peer.uid}.message.${scope}`)
        this.events.emit(`peers.${peer.uid}.message.${scope}`, data, scope, peer)
      })
    })
    this.tracker.on('peer_join', peer => this.events.emit('peer_join', peer))
    this.tracker.on('peer_leave', peer => this.events.emit('peer_leave', peer))

    // Proxy tracker connection state events
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
      this.tracker.on(event, (...args) => this.events.emit(event, ...args))
    })

    // Reach out to tracker server
    await this.tracker.connect()

    // Join the default plane if configured
    if (this.selectedPlane) {
      // Enter our initial plane
      this.enterPlane(this.selectedPlane)
    }

    // Automatically connect to new peers, if configured
    if (this.autoPeer) {
      this.tracker.on('peer_join', peer => {
        let p = this.tracker.getPeer(peer)
        console.log('Auto-connecting to ', p)
        this.connectToPeer(p)
      })
    }

    return true
  }


  /**
   * Return a lens through which we can operate on planes.
   * @param planeId
   */
  plane(planeId: string) {
    return new PlaneScope(planeId, this)
  }

  enterPlane(planeId: string) {
    if (!this.tracker) { throw new Error("Can't enter plane when Tracker is not initialized! Boot the Omniverse first!")}
    this.tracker.enterPlane(planeId)
    console.info(`Connected to plane ${planeId}`)
  }

  get peerTracker() { return this.tracker }

  /**
   * Connect to a peer specified by a Peer object. This typically comes
   * from the peer table or via a notification of a new peer joining.
   * @param peer
   */
  async connectToPeer(peer: IPeer) {
    if (!this.tracker) { throw new Error('Peer tracker not initialized!') }
    try {
      await this.tracker.initiatePeerConnection(peer.uid)
      return peer
    } catch (e) {
      console.error(e)
      return false
    }
  }

  deconstruct() {
    if (!this.tracker) { throw new Error('Peer tracker not initialized!') }
    this.tracker.disconnect()
  }
}
