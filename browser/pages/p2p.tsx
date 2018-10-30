import {useEffect, useState} from 'react'
import NoSSR from 'react-no-ssr'
import * as _ from 'lodash'

type RemotePeer = {
  uid: string,
  connection: any
}


let selfuid = Math.floor(Math.random() * 999999999).toString(36)
let Peer, peer
let io, socket
if (typeof window !== 'undefined') {
  Peer = require('simple-peer');
  io = require('socket.io-client');
  socket = io(`http://zerilliworks.local:8765?uid=${selfuid}`)
}

if (typeof window !== 'undefined') {
}

let PeerTable: RemotePeer[] = []

function P2P(props) {
  let [uid, setuid]: [string, (uid: string) => void] = useState(selfuid)
  let [messageField, setMessageField] = useState("")
  let [offer, setOffer] = useState({_pending: true})
  let [planes, setPlane] = useState({})
  let [messageLog, setMessageLog] = useState([])

  useEffect(function () {

    socket.on('planeupdate', event => {
      console.log('PLANE_UPDATE', event)
      setPlane(event)
    })

    /**
     *        PEER A                                        PEER B
     *  initiate_connection(peer_b_id)       -> connection_offer(peer_a_id, offer)
     *  connection_answer(peer_b_id, answer) <- connection_answer(peer_b_id, answer)
     */

    socket.on('connection_offer', ({from_peer: peerId, offer}) => {
      console.log("Received connection offer from", peerId, offer)
      // Create a Peer connection to link to the requester
      let remotePeerConnection = new Peer({initiator: false, trickle: false})
      PeerTable.push({uid: peerId, connection: remotePeerConnection})

      // Set up peer event listeners
      remotePeerConnection.on('connect', function () {
        console.log('CONNECT', peerId)
      })

      remotePeerConnection.on('error', function (err) {
        console.log('error', err)
      })

      remotePeerConnection.on('data', function (data) {
        console.log('data: ' + data)
        setMessageLog([...messageLog, {from: peerId, data}])
      })

      // Send a reply with an answer to the peer that initiated this connection
      // from_peer: myself and to_peer: the peer that asked to initiate
      remotePeerConnection.once('signal', data => socket.emit('connection_answer', {from_peer: uid, to_peer: peerId, answer: data}))
      remotePeerConnection.signal(offer)
    })

    socket.on('connection_answer', ({from_peer: peerId, answer}) => {
      console.log("Received connection answer from", peerId, answer)
      // Signal the answer
      // from_peer: peer that replied to my request
      // to_peer: myself
      console.log(PeerTable)
      _.find(PeerTable, {uid: peerId}).connection.signal(answer)
    })
  }, [uid])

  function informPeers(e) {
    _.forEach(PeerTable, peer => {
      peer.connection.send(messageField)
    })
    setMessageLog([...messageLog, {from: uid, data: messageField}])
    setMessageField("")
  }

  function peerConnector(peerUid) {
    return () => {
      // Bail early if the peer is already in the peer table
      if(_.find(PeerTable, {uid: peerUid})) { return }

      // Create a new peer connection as the initiator
      const remotePeerConnection = new Peer({initiator: true, trickle: false})

      // Set up peer event listeners
      remotePeerConnection.on('connect', function () {
        console.log('CONNECT', peerUid)
      })

      remotePeerConnection.on('error', function (err) {
        console.log('error', err)
      })

      remotePeerConnection.on('data', function (data) {
        console.log('data: ' + data)
        setMessageLog([...messageLog, {from: peerUid, data}])
      })

      // Send the peering request once a signal with an offer is generated
      remotePeerConnection.on('signal', function (data) {
        console.log('SIGNAL', JSON.stringify(data))
        socket.emit('initiate_connection', {to_peer: peerUid, from_peer: uid, offer: data})
      })

      // Update peer table
      PeerTable.push({uid: peerUid, connection: remotePeerConnection})
    }
  }

  return (
    <div>
      <p>I am {uid}</p>
      <pre>{JSON.stringify(offer)}</pre>
      <p>Available Planes:</p>
      <div>
        {_.map(planes, (plane, id) => {
          return (
            <div>
              <h1>Plane {id}</h1>
              <h3>Peers:</h3>
              <ul>
                {_(plane.peers).reject(_.matches(uid)).map(peer => (
                  <li>{peer}
                    <button onClick={peerConnector(peer)}>Connect</button>
                  </li>
                )).value()}
              </ul>
            </div>
          )
        })}
      </div>
      <textarea onChange={e => setMessageField(e.target.value)}
                value={messageField}
                placeholder="Inform peers"/>
      <button onClick={informPeers}>Send</button>
      <pre>{messageLog.map(m => `${m.from}: ${m.data}`).join('\n')}</pre>
    </div>
  )
}

export default props => <NoSSR><P2P {...props}/></NoSSR>
