import {Component, CSSProperties, WheelEvent} from 'react'
import * as React from 'react'
import {map, throttle} from 'lodash'
import * as localForage from 'localforage'
import ac from '../ambient-console'
import Omniverse from '../omniverse'
import {RemotePeer} from '../omniverse/peer'

interface ITownPlaneState {
  canvas: {
    offset: [number, number],
    scale: number
  },
  panning: boolean,
  ghostCursors: Record<string, {
    clientX: number,
    clientY: number
  }>
}


interface ITownPlaneProps {
  renderControls?: React.SFC
}

export default class TownPlane extends Component<ITownPlaneProps, ITownPlaneState> {
  private userId: string
  private omniverse: Omniverse

  constructor(props) {
    super(props)

    this.omniverse = new Omniverse({trackerUrl: 'https://server-preview-ma-mkw5kd.government.browser.town'})
    if (typeof window !== 'undefined') window.omniverse = this.omniverse

    this.state = {
      canvas: {
        offset: [0.0, 0.0],
        scale: 1.0
      },
      panning: false,
      ghostCursors: {}
    }

    this.beginPan = this.beginPan.bind(this)
    this.endPan = this.endPan.bind(this)
    this.panCanvas = this.panCanvas.bind(this)
    this.updateCursor = this.updateCursor.bind(this)
    this.scrollCanvas = this.scrollCanvas.bind(this)

    this.updateCursor = throttle(this.updateCursor.bind(this), 50)
  }

  render() {
    return <div className={'wrapper  w-full h-full pin cursor-browsertown-move'}
                style={{
                  touchAction: 'none',
                  background: `url(/static/images/reticle-grid.svg)`,
                  backgroundPosition: `${this.state.canvas.offset[0] % 64}px ${this.state.canvas.offset[1] % 64}px`
                }}
                onMouseDown={this.beginPan}
                onMouseUp={this.endPan}
                onMouseLeave={this.endPan}
                onMouseMove={e => {
                  this.panCanvas(e), this.updateCursor(e.clientX - this.state.canvas.offset[0], e.clientY - this.state.canvas.offset[1])
                }}
                onWheel={this.scrollCanvas}
    >
      <div className="fixed z-50 w-full pin-t">{this.props.renderControls({})}</div>
      <div style={{...this.getCanvasTransform()}}
           className={'canvas-root w-full h-full'}>
        {map(this.state.ghostCursors, (cursor, id) => (
          cursor &&
          <div
            key={`cursor-${id}`}
            className="fixed w-8 h-8 pt-5 pl-4 text-grey text-sm"
            style={{
              transform: `translate(${cursor.x}px, ${cursor.y}px)`,
              background: `url(/static/images/cursor.svg)`
            }}>
            {id}
          </div>
        ))}
        {this.props.children}
      </div>
    </div>
  }

  async componentDidMount() {
    setTimeout(() => {
      ac.log('~~~ HELLO THERE ~~~')
      ac.log('Browser Town v0.0.42')
      ac.log('~~~~~~~~~~~~~~~~~~~')
      ac.log('Booting the omniverse...')
    })

    this.omniverse.boot()
      .then(() => {
        ac.log('Portal to omniverse open at ' + this.omniverse.url)

        // Bind join events
        this.omniverse.on('peer_join',  (peer: RemotePeer) => {
          ac.log(`Remote peer joined: ${peer.uid}`)
          this.omniverse.connectToPeer(peer)
            .catch(err => {
              ac.error("Could not connect to peer!")
              ac.error(err)
            })
        })

        // Bind leave events
        this.omniverse.on('peer_leave',  (peer) => {
          ac.log(`Remote peer left: ${peer.peer}`)
        })

        // Bind connect events
        this.omniverse.on('peer_connected',  (peer) => {
          ac.log("Connected to " + peer.uid)
        })

        // Bind incoming cursor updates
        this.omniverse.on('peers.*.message.*', (data: any, scope: string, fromPeer: RemotePeer) => {
          this.setState({
            ghostCursors: {
              ...this.state.ghostCursors,
              [fromPeer.shortUid]: data
            }
          })
        })
      })
      .catch(console.error.bind(console))
  }

  componentWillUnmount() {
    ac.log('>>>>>>!!! REBOOT !!!<<<<<<')
    this.omniverse.deconstruct()
  }

  getCanvasTransform(): CSSProperties {
    let {scale, offset: [x, y]} = this.state.canvas

    return {
      transformOrigin: '0px 0px 0px',
      transform: `translate(${x}px, ${y}px) scale(${scale})`
    }
  }

  private beginPan(event) {
    this.setState({panning: true})
  }

  private endPan(event) {
    this.setState({panning: false})
  }

  private panCanvas(event: React.MouseEvent<HTMLDivElement>) {
    if (this.state.panning === false) {
      return
    }

    let {scale, offset: [x, y]} = this.state.canvas
    let dx = event.movementX
    let dy = event.movementY

    this.setState({
      canvas: {
        ...this.state.canvas,
        offset: [x + dx, y + dy],
        scale
      }
    })
  }

  private scrollCanvas(event: WheelEvent) {
    let {scale, offset: [x, y]} = this.state.canvas
    let dx = event.deltaX
    let dy = event.deltaY

    event.preventDefault()

    this.setState({
      canvas: {
        ...this.state.canvas,
        offset: [x + dx, y + dy],
        scale
      }
    })
  }

  private updateCursor(clientX, clientY) {
    this.omniverse.plane('1').broadcast('cursor_update', {x: clientX, y: clientY})
  }
}