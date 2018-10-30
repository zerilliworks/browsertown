import {Socket} from "socket.io";

console.log("If module not found, install express globally `npm i express -g`!");
const port = process.env.OPENSHIFT_NODEJS_PORT || process.env.VCAP_APP_PORT || process.env.PORT || process.argv[2] || 8765;
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

io.on('connection', (socket: Socket) => {

  // Add the peer to our Plane datastructure
  const socketUid = socket.handshake.query.uid
  incrementConn(socketUid)

  console.log("Peer connected", socket.handshake.query)
  socket.join('planes.1')
  socket.join(`peer.${socketUid}`)

  planes[1].peers.push(socketUid)
  peerTable[socketUid] = {uid: socketUid, socket}

  // Broadcast new peers
  io.emit('plane_update', planes[1])
  socket.broadcast.to('planes.1').emit('peer_join', {peer: socketUid, plane: "1"})

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



// Go
const server = http.listen(port)
Gun({	file: 'data.json', web: server });

console.log('GUN Server started on port ' + port + ' with /gun');
console.log('Peering Server started on port ' + port + ' with /peer');
