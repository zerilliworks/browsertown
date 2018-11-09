import {IPeer} from './peer'
import StateMachine from 'javascript-state-machine'

enum PeerConnectionState {
  CLOSED,
  CONNECTING,
  CONNECTION_ERROR,
  CONNECTION_TIMEOUT,
  RECONNECTING,
  RECONNECT_ERROR,
  RECONNECT_TIMEOUT,
  OPEN
}

enum PeerNegotiationState {
  NONE,
  CONNECTION_OFFER_SENT,
  CONNECTION_OFFER_RECEIVED,
  CONNECTION_ANSWER_SENT,
  CONNECTION_ANSWER_RECEIVED,
  CONNECTION_ANSWER_TIMEOUT,

}

interface PeerConnectionFSM {
  state: ''
}

type PeerTableEntry = {
  peerInstance: IPeer
}

export default class PeerTable2 {
  private fsm: object

  constructor() {
    // @ts-ignore
    this.fsm = new StateMachine({
      init: 'none',

      transitions: [
        // Happy path on initiator
        {name: 'initiate', from: 'none', to: 'offer_sent'},
        {name: 'receive_answer', from: 'offer_sent', to: 'offer_answered'},
        {name: 'attempt', from: 'offer_answered', to: 'connecting'},
        {name: 'connection_succeed', from: 'connecting', to: 'connection_open'},

        // Happy path on receiver
        {name: 'receive_offer', from: 'none', to: 'offer_received'},
        {name: 'respond_to_offer', from: 'offer_received', to: 'offer_answer_sent'},
        {name: 'connection_succeed', from: 'offer_answer_sent', to: 'connection_open'},

        // Handshake issues
        {name: 'offer_time_out', from: 'offer_sent', to: 'offer_timed_out'},
        {name: 'retry', from: 'offer_timed_out', to: 'offer_sent'},
        {name: 'fail', from: 'offer_timed_out', to: 'signalling_failed'},

        {name: 'answer_time_out', from: 'offer_answer_sent', to: 'answer_timed_out'},
        {name: 'retry', from: 'answer_timed_out', to: 'offer_answer_sent'},
        {name: 'fail', from: 'answer_timed_out', to: 'signalling_failed'},

        {name: 'reject_offer', from: 'offer_received', to: 'offer_rejected'},

        // Connection states
        {name: 'close_connection', from: 'connection_open', to: 'connection_closed'},
        {name: 'heartbeat_timeout', from: 'connection_open', to: 'heartbeat_timed_out'},
        {name: 'reconnect', from: 'heartbeat_timed_out', to: 'reconnecting'},
        {name: 'reconnect_succeed', from: 'reconnecting', to: 'connection_open'},
        {name: 'reconnect_failed', from: 'reconnecting', to: 'connection_closed'},
      ],

      methods: {}
    })
  }
}