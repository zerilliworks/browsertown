import * as _ from 'lodash'

let peers = {
  1: {
    id: '1',
    seqs: [],
    subs: []
  }
}

let buffer = {}

export function broadcastState(uuid, seq, data) {
  // Store the broadcast in the buffer
  _.set(buffer, [uuid, seq], data)

  // Loop over the set of all peers you know
  _.map(peers, p => {
    // Check if the peer is interested in what you're broadcasting,
    // and its seq clock is lower than the change in question
    if (_.includes(p.subs, uuid) && p.seqs[uuid] < seq) {
      // Send an update to the peer. Peer will send an ack that is handled by receiveAck()
      sendPacket(p, {
        _packetType: 'ENTITY_UPDATE',
        _seq: seq,
        changes: data
      })
    }
  })
}

function receiveState(uuid, seq, data) {

}

function receiveAck(peer, uuid, seq) {
  // Test if the new ack is greater than what we know so far and update only if it is
  if(seq > _.get(peers, [peer, 'seqs', uuid], seq)) {
    _.set(peers, [peer, 'seqs', uuid], seq)
  }
}
