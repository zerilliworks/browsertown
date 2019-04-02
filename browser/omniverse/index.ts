import {LocalPeer} from './local-peer'
import PouchDB from 'pouchdb'
import {v4 as uuid} from 'uuid'
import PeerTracker from "./peer-tracker";
import {EventEmitter2} from "eventemitter2";
import {defaults} from 'lodash'
import {IPeer, PeerUUID} from './peer'
import PlaneObjects, {PlaneObject, PlaneObjectCursor} from '../omniverse/plane-objects'
import {RemotePeer} from "./remote-peer";

class PlaneScope {
  private _omniverse: Omniverse;
  private _planeId: string;
  objects: PlaneScopeObjects;
  chat: PlaneScopeChat;

  get omniverse(): Omniverse {
    return this._omniverse;
  }
  get planeId(): string {
    return this._planeId;
  }

  constructor(planeId: string, omniverse: Omniverse) {
    this._planeId = planeId
    this._omniverse = omniverse
    this.objects = new PlaneScopeObjects(this)
    this.chat = new PlaneScopeChat(this)
  }

  peers(): IPeer[] {
    return this._omniverse.getPeersInPlane(this._planeId)
  }

  neighbors(): Array<{plane: string | undefined, peer: string}> {
    if (!this._omniverse.peerTracker) { return [] }
    return this._omniverse.peerTracker.getNeighbors({plane: this._planeId})
  }

  broadcast(scope: string, payload: any) {
    this._omniverse.broadcastToPlane(this._planeId, scope, payload)
  }

  getObjects() {
    return this._omniverse.getObjectsInPlane(this._planeId);
  }

  addObject(po: PlaneObject<any>) {
    this._omniverse.addObjectToPlane(this._planeId, po);
    this.broadcast('objects.new', po)
  }
}

class PlaneScopeObjects {
  private scope: PlaneScope;
  constructor(scope: PlaneScope) {
    this.scope = scope
  }

  subscribe() {

  }

  create(po: PlaneObject<any>) {
    this.scope.omniverse.addObjectToPlane(this.scope.planeId, po)
  }

  search() {

  }

  all() {
    return this.scope.omniverse.getObjectsInPlane(this.scope.planeId)
  }

  select(id: string) {

  }
}

class PlaneScopeChat {
  private scope: PlaneScope;

  constructor(scope: PlaneScope) {
    this.scope = scope
  }

  create(message: string) {

  }

  subscribe() {

  }

  search(predicate: object) {

  }

  log() {

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
  private _planeObjects: Record<string, PlaneObjects>;

  constructor(options: { trackerUrl: string; autoPeer: boolean; plane?: string; debug?: boolean}) {
    this.options = options
    let {trackerUrl, autoPeer, plane} = defaults(options, Omniverse.defaultOptions)
    this.autoPeer = autoPeer
    this.trackerUrl = trackerUrl
    this.events = new EventEmitter2({wildcard: true})
    this.selectedPlane = plane || null
    this.debug = Boolean(options.debug)
    this._planeObjects = {}
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
        // console.debug('Incoming peer broadcast', data, scope, peer.uid)
        // console.debug('Re-emitted as', `peers.${peer.uid}.message.${scope}`)
        this.events.emit(`peers.${peer.uid}.message.${scope}`, data, scope, peer)
      })
    })
    this.tracker.on('peer_join', peer => {
      this.events.emit('peer_join', peer)
    })
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

      // Create a space for PlaneObjects
      this._planeObjects[this.selectedPlane] = new PlaneObjects()
    }

    // Automatically connect to new peers, if configured
    if (this.autoPeer) {

      this.tracker.on('peer_announce', peer => {
        if (peer.uid > this.myPeerUid) {
          console.log("Anticipating auto-connection from", peer)
          return
        }

        console.log('Auto-connecting to ', peer)
        this.connectToPeer(peer)
      })

      // this.tracker.on('peer_join', peer => {
      //   // Test if peer will auto-initiate with us or vice-versa
      //   if (peer.uid > this.myPeerUid) {
      //     console.log("Anticipating auto-connection from", peer)
      //     return
      //   }
      // })
    }

    // Set up event bindings to sync PlaneObject states
    this.on('peers.*.message.object.new', (po: PlaneObject<any>, scope: string, fromPeer: RemotePeer) => {
      // Insert new objects into PO table, bypassing event triggers
      this._planeObjects.add(po)
    })

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
    if (!this._planeObjects[planeId]) {
      // Initialize a PlaneObjects instance if we don't already have one
      this._planeObjects[planeId] = new PlaneObjects()
    }
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

  /**
   * Perform teardown work when destroying an Omniverse
   */
  deconstruct() {
    if (!this.tracker) { throw new Error('Peer tracker not initialized!') }
    this.tracker.disconnect()
  }

  debugInfo() {
    console.dir({
      "Connection Offers": this.peerTracker.connectionOffers
    })
  }

  private getPlaneObjectsInstance(planeId: string): PlaneObjects | null {
    return this._planeObjects[planeId] || null
  }

  getObjectsInPlane(planeId: string) {
    let POI = this.getPlaneObjectsInstance(planeId)
    if (POI) {
      return POI.objects
    }
    else {
      return PlaneObjectCursor({})
    }
  }

  addObjectToPlane(planeId: string, po: PlaneObject<any>) {
    let POI = this.getPlaneObjectsInstance(planeId)
    if (POI) {
      // TODO: This should be centralized into the PlaneObject class, and Omniverse just listens for add events
      this.events.emit('objects.new', po)
      return POI.add(po)
    }
    else {
      throw `Plane Objects instance not initialized for plane ${planeId}`
    }
  }

  broadcastToPlane(planeId: string, scope: string, payload: any) {
    let res = this.getPeersInPlane(planeId).map(peer => {
      return peer.sendData(planeId, scope, payload)
    })
    return res
  }

  getPeersInPlane(planeId: string) {
    if (!this.peerTracker) { return [] }
    return this.peerTracker.getPeers({plane: planeId})
  }
}
