import {Socket} from "socket.io";
import * as crypto from "crypto";
import {Request, Response} from "express";

const express = require('express');
const app = express();
const http = require('http').Server(app)
const path = require('path')

type Plane = {
  id: string,
  origin: [number, number],
  peers: any[]
}

type Planes = Record<string, Plane>

type PeerTable = Record<string, {
  uid: string,
  socket: Socket
}>

let planes: Planes = {
  "1": {
    id: "1",
    origin: [0,0],
    peers: []
  }
}

let peerTable: PeerTable = {}

// Track the count of open connections so we don't erroneously emit peer_leave messages
let connections: Record<string, number> = {}
const incrementConn = (pid: string) => connections[pid] = (connections[pid] | 0) + 1
const decrementConn = (pid: string) => connections[pid] = (connections[pid] - 1)

// Create hashes of plane IDs
const hashPlaneId = (id: string) => {
  let idHash = crypto.createHash('sha256')
  idHash.update(id)
  return idHash.digest().toString()
}

// GUN setup
const Gun = require('gun');

app.use(Gun.serve);
app.use(express.static(path.join(__dirname, 'static')));

// Peer signalling setup
const io = require('socket.io')(http)

function filterOwnPeerFromPlaneMetadata(selfPeer: string, planeMetadata: Plane) {
  return {
    ...planeMetadata,
    peers: planeMetadata.peers.filter(p => p !== selfPeer)
  }
}

function findOrCreatePlane(plane_id: string): Plane {
  let planeHash = hashPlaneId(plane_id);
  if(planes[planeHash]) {
    return planes[planeHash]
  }
  else {
    return planes[planeHash] = {
      id: plane_id,
      origin: [0,0],
      peers: []
    }
  }
}

io.on('connection', (socket: Socket) => {

  // Ping
  socket.on('heartbeat', (memo: string, reply) => {
    console.log('PING')
    reply('dub')
  })

  // Add the peer to our Plane datastructure
  const socketUid = socket.handshake.query.uid
  incrementConn(socketUid)

  console.log("Peer connected", socket.handshake.query)

  // Join a private room for communications to this peer alone
  socket.join(`peer.${socketUid}`)

  // Listen for requests to join planes
  socket.on('enter_plane', ({plane_id}) => {
    let planeRoom = `planes.${hashPlaneId(plane_id)}`;
    let planeObject = findOrCreatePlane(plane_id)
    planeObject.peers.push(socketUid)
    socket.join(planeRoom)

    // Broadcast new peers
    socket.broadcast.to(planeRoom).emit('plane_update', planeObject)
    socket.broadcast.to(planeRoom).emit('peer_join', {peer: socketUid, plane: "1"})
  })

  peerTable[socketUid] = {uid: socketUid, socket}

  // Handle disconnections, update plane object to remove active peer
  socket.on('disconnect', (reason) => {
    console.log("Peer disconnected", reason, socket.handshake.query)
    socket.leaveAll()
    delete peerTable[socketUid]
    planes[1].peers = planes[1].peers.filter(p => p !== socketUid)
    io.emit('plane_update', planes[1])
    if (decrementConn(socketUid) == 0) {
      socket.broadcast.to('planes.1').emit('peer_leave', {peer: socketUid, plane: "1"})
    }
  })

  socket.on('initiate_connection', ({to_peer: toUid, from_peer: fromUid, offer}) => {
    // Send a message to the target peer (peerUid) with a payload that has the offer
    // and the peer ID of the initiator (socketUid)
    io.to(`peer.${toUid}`).emit('connection_offer', {to_peer: toUid, from_peer: fromUid, offer})
  })

  socket.on('connection_answer', ({to_peer: toUid, from_peer: fromUid, answer}) => {
    io.to(`peer.${toUid}`).emit('connection_answer', {to_peer: toUid, from_peer: fromUid, answer})
  })
})


function startServer(port?: number) {
  // Go
  const server = http.listen(port)
  Gun({	file: 'data.json', web: server });

  const actualPort = server.address().port

  console.log('GUN Server started on port ' + actualPort + ' with /gun');
  console.log('Peering Server started on port ' + actualPort + ' with /peer');

  return server
}

export {startServer, app, http}
