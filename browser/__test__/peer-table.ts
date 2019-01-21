import test from 'ava'
import PeerTable from "../omniverse/peer-table";
import {LocalPeer} from "./local-peer";
import {RemotePeer} from '../omniverse/remote-peer'

test('peer table instantiates', (t) => {
  t.notThrows(() => new PeerTable(new LocalPeer()))
})

test('peer table inserts peers in planes', async (t) => {
  try {
    const pt = new PeerTable(new LocalPeer(), {trace: false})

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
  } catch (e) {
    console.log(e)
    t.fail(e)
  }
})

test('ok', t => t.pass())
