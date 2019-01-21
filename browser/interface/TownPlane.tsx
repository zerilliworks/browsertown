import {Component, CSSProperties, WheelEvent, MouseEvent} from 'react'
import * as React from 'react'
import {map, throttle} from 'lodash'
import ac from '../ambient-console'
import Omniverse from '../omniverse'
import {IPeer} from './peer'
import getConfig from 'next/config'
const {publicRuntimeConfig} = getConfig()

interface ITownPlaneState {
  canvas: {
    offset: [number, number],
    scale: number
  },
  panning: boolean,
  ghostCursors: Record<string, {
    x: number,
    y: number
  }>
}


interface ITownPlaneProps {
  renderControls: React.SFC
}

export default class TownPlane extends Component<ITownPlaneProps, ITownPlaneState> {
  private omniverse: Omniverse

  constructor(props: ITownPlaneProps) {
    super(props)

    this.omniverse = new Omniverse({trackerUrl: publicRuntimeConfig.omniverseUrl, plane: 'public', autoPeer: true})
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
      ac.log(`~~~ HELLO THERE ~~~
      BrowserTown v0.0.48
      ~~~~~~~~~~~~~~~~~~~
      Booting the omniverse...`)
    })

    this.omniverse.boot()
      .then(() => {
        ac.log('Portal to omniverse open at ' + this.omniverse.url)
        ac.log('I am peer with ID ' + this.omniverse.myPeerUid)
        this.printHelp()

        // Bind join events
        this.omniverse.on('peer_join',  (peer: IPeer) => {
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
        this.omniverse.on('peers.*.message.*', (data: any, scope: string, fromPeer: IPeer) => {
          console.log(data)
          this.setState({
            ghostCursors: {
              ...this.state.ghostCursors,
              [fromPeer.shortUid]: data
            }
          })
        })

        // Bind shouts
        this.omniverse.on('peers.*.message.shout', (data: any, scope: string, fromPeer: IPeer) => {
          ac.log("%c %s: %s", "color: blue", fromPeer.shortUid, data.message)
        })
      })
      .catch(console.error.bind(console))
  }

  componentWillUnmount() {
    ac.log('>>>>>>!!! REBOOT !!!<<<<<<')
    this.omniverse.deconstruct()
  }

  private printHelp() {
    ac.log(`
    > TIPS:
    - Click and drag to move around, or scroll on your trackpad
    - Press 's' on your keyboard to shout
    `)
  }

  getCanvasTransform(): CSSProperties {
    let {scale, offset: [x, y]} = this.state.canvas

    return {
      transformOrigin: '0px 0px 0px',
      transform: `translate(${x}px, ${y}px) scale(${scale})`
    }
  }

  private beginPan(event: MouseEvent) {
    this.setState({panning: true})
  }

  private endPan(event: MouseEvent) {
    this.setState({panning: false})
  }

  private panCanvas(event: MouseEvent<HTMLDivElement>) {
    if (this.state.panning === false) {
      return
    }

    let {scale, offset: [x, y]} = this.state.canvas
    // @ts-ignore
    let dx = event.movementX
    // @ts-ignore
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

  private updateCursor(clientX: number, clientY: number) {
    this.omniverse.plane('public').broadcast('cursor_update', {x: clientX, y: clientY})
  }
}