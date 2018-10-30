import * as React from "react";
import Omniverse from "../omniverse";
import {RemotePeer} from "../omniverse/peer";
import {EventEmitter2} from "eventemitter2";

// import '../css/app.css'

interface Props {
}

interface State {
  peers: RemotePeer[],
  connectedPeers: RemotePeer[],
  messages: Array<{
    author: string,
    content: string
  }>
}

export default class P2PPlane extends React.Component<Props, State> {
  private omniverse: Omniverse;
  private chat: EventEmitter2;
  private chatField: React.RefObject<any>;

  constructor(props) {
    super(props)

    this.omniverse = new Omniverse()

    if (typeof window !== "undefined") {
      window.omniverse = this.omniverse
    }

    this.chat = new EventEmitter2()
    this.chat.onAny(console.log.bind(console))

    this.state = {
      peers: [],
      connectedPeers: [],
      messages: []
    }
  }

  componentDidMount() {
    this.omniverse.boot()
      .then(() => {
        this.omniverse.peerTracker.on('peer_update', async () => {
          let peers = this.omniverse.plane("1").peers()
          this.setState({peers})
        })
      })
      .catch(console.error.bind(console))

    this.omniverse.on('peer_connected', (peer: RemotePeer) => {
      // Add to the array of connected peers
      this.setState({connectedPeers: [...this.state.connectedPeers, peer]})

      peer.connection.on('data', console.log.bind(console))

      // Bind to incoming data events
      peer.onData('chat.message', message => {
        this.setState({
          messages: [
            ...this.state.messages,
            message
          ]
        })
      })

      // Relay message events from us to all our peers
      this.chat.on('send_message', (author, content) => {
        this.setState({
          messages: [
            ...this.state.messages,
            {author, content}
          ]
        })
        console.debug("Sending message to peer")
        peer.sendData('chat.message', {author, content})
      })
    })

    this.chatField = React.createRef()

  }

  componentWillUnmount() {
    this.omniverse.deconstruct()
  }

  render() {
    return (
      <div className={""}>
        <h1>Connected Peers</h1>
        <ul>
          {this.state.connectedPeers.map(peer => <li>{peer.uid}</li>)}
        </ul>
        <hr/>
        <h1>Available Peers</h1>
        <h2>Plane 1</h2>
        <p>I am {this.omniverse.myPeerUid}</p>
        <ul>
          {this.state.peers.map(peer => <li>{peer.uid}
            <button onClick={() => this.connectPeer(peer)}>Connect</button>
          </li>)}
        </ul>
        <hr/>
        <input ref={this.chatField} type="text" placeholder="type a message"/>
        <button onClick={this.sendMessage()}>Send</button>
        <pre>
          {this.state.messages.map(message => {
            return `${message.author.split("-")[0]}: ${message.content}\n`
          })}
        </pre>
      </div>
    )
  }

  async connectPeer(peer: RemotePeer) {
    await this.omniverse.connectToPeer(peer)
  }

  private sendMessage() {
    return e => {
      let author = this.omniverse.myPeerUid
      let content = this.chatField.current.value
      this.chat.emit('send_message', author, content)
      this.chatField.current.value = ""
    }
  }
}
