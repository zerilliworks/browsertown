import {Socket} from "socket.io";
import * as crypto from "crypto";

const express = require('express');
const app = express();
const http = require('http').Server(app)
const path = require('path')

let knownPlanes: Record<string, any> = {}

// Create hashes of plane IDs
const hashPlaneId = (id: string) => {
  let idHash = crypto.createHash('sha256')
  idHash.update(id)
  return idHash.digest('hex').toString()
}

const planeRoomName = (planeId: string) => {
  return `plane.${hashPlaneId(planeId)}`
}

app.use(express.static(path.join(__dirname, 'static')));

// Peer signalling setup
const io = require('socket.io')(http, {path: '/peer'})

io.on('connection', (socket: Socket) => {

  // Ping
  socket.on('heartbeat', (memo: string, reply) => {
    console.log('PING')
    reply('dub')
  })

  // Add the peer
  const socketUid = socket.handshake.query.uid

  console.log("Peer connected", socket.handshake.query)

  // Join a private room for communications to this peer alone
  const socketPeerRoom = `peer.${socketUid}`
  socket.join(socketPeerRoom)

  // Listen for requests to join planes
  socket.on('enter_plane', ({plane_id}, reply = () => {}) => {
    console.log(`Peer ${socketUid} entering ${plane_id}`)
    try {
      // Generate a plane ID and record it in the known planes
      let planeRoom = planeRoomName(plane_id);
      knownPlanes[hashPlaneId(plane_id)] = {
        room: planeRoom,
        name: plane_id
      }

      // Join the plane room
      socket.join(planeRoom)

      // Broadcast a "roll_call" request to all other peers in this plane
      // which solicits an "announce" response from them.
      socket.to(planeRoom).broadcast.emit('roll_call', {newbie: socketUid, plane: plane_id})

      // Emit an "announce" message for the new peer that just entered
      socket.to(planeRoom).broadcast.emit('announce', {fromPeer: socketUid, plane: plane_id})
      console.log("announce", socketUid, plane_id)
    }
    catch (e) {
      reply('error')
    }
  })

  // Proxy roll-call replies to peers
  socket.on('announce', ({fromPeer, plane}) => {
    console.log("announce", fromPeer, plane)
    socket.to(planeRoomName(plane)).broadcast.emit('announce', {fromPeer, plane})
  })

  // Handle disconnections, update plane object to remove active peer
  socket.on('disconnect', (reason) => {
    console.log("Peer disconnected", reason, socket.handshake.query)

    // Announce to all planes that this client joined that it's leaving
    Object.keys(socket.rooms).map(room => {
      socket.to(room).broadcast.emit('peer_leave', {uid: socketUid})
    })

    // Exit
    socket.leaveAll()
  })

  socket.on('initiate_connection', ({to_peer: toUid, from_peer: fromUid, offer}) => {
    // Send a message to the target peer (peerUid) with a payload that has the offer
    // and the peer ID of the initiator (socketUid)
    console.log(`Peer initiating: ${fromUid} --> ${toUid} (${offer.length} bytes)`)
    io.to(`peer.${toUid}`).emit('connection_offer', {to_peer: toUid, from_peer: fromUid, offer})
  })

  socket.on('connection_answer', ({to_peer: toUid, from_peer: fromUid, answer}) => {
    console.log(`Peer answering: ${fromUid} --> ${toUid} (${answer.length} bytes)`)
    io.to(`peer.${toUid}`).emit('connection_answer', {to_peer: toUid, from_peer: fromUid, answer})
  })
})


function startServer(port?: number) {
  // Go
  const server = http.listen(port)

  const actualPort = server.address().port

  console.log('Peering Server started on port ' + actualPort + ' with /peer');

  return server
}

export {startServer, app, http}
