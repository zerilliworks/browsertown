import test from 'ava'
import PeerTable from "../omniverse/peer-table";
import {LocalPeer, RemotePeer} from "../omniverse/peer";

test('peer table instantiates', (t) => {
  t.notThrows(() => new PeerTable(new LocalPeer()))
})

test('peer table inserts peers in planes', (t) => {
  const pt = new PeerTable(new LocalPeer())

  t.throws(() => pt.insert(new RemotePeer("peer_one", {direct: true})))

  pt.plane("A").insert(new RemotePeer("peer_one", {direct: true}))
  pt.plane("A").insert(new RemotePeer("peer_two", {direct: true}))
  pt.plane("A").insert(new RemotePeer("peer_three", {direct: true}))
  pt.plane("B").insert(new RemotePeer("peer_four", {direct: true}))
  pt.plane("B").insert(new RemotePeer("peer_five", {direct: true}))
  pt.plane("B").insert(new RemotePeer("peer_six", {direct: true}))
  pt.plane("B").insert(new RemotePeer("peer_seven", {direct: true}))

  t.is(pt.all().length, 7)
  t.is(pt.plane("A").all().length, 3)
  t.is(pt.plane("B").all().length, 4)

  // Scope shouldn't be sticky
  t.is(pt.all().length, 7)
})
