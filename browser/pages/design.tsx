import '../css/app.css'

import SearchBar from '../interface/SearchBar'
import * as React from "react";
import {CSSProperties, WheelEvent} from "react";
import CommentBubble from "../interface/CommentBubble";
import Gun from 'gun/gun'
import 'gun/sea'
import 'gun/lib/then'
import 'gun/lib/open'
import ac from '../ambient-console'
import {throttle, map} from 'lodash'
import localForage from 'localforage'

interface State {
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

interface Props {
}

export default class Design extends React.Component<Props, State> {
  private gun: any;
  private userId: string;

  constructor(props: Props) {
    super(props)

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
    return <div className={"w-full h-full pin cursor-browsertown-move"}
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
                onWheel={this.scrollCanvas}>
      <div className="fixed z-50 w-full pin-t"><SearchBar/></div>
      <div style={{...this.getCanvasTransform()}}
           className={"canvas-root w-full h-full"}>
        {map(this.state.ghostCursors, (cursor, id) => (
          cursor &&
          <div
            key={`cursor-${id}`}
            className="fixed w-8 h-8 pt-5 pl-4 text-grey text-sm"
            style={{
              transform:`translate(${cursor.clientX}px, ${cursor.clientY}px)`,
              background: `url(/static/images/cursor.svg)`
            }}>
            {id}
          </div>
        ))}
        <CommentBubble author={"@dipshit"} color={"red"} avatarUrl={"https://placekitten.com/64/64"}
                       timestamp={"3m ago"}>
          Lorem ipsum dolor sit amet, consectetur adipisicing elit. Accusamus aperiam delectus est exercitationem hic
          illo
          libero nostrum qui saepe! Aliquam amet aperiam, delectus ipsa molestiae quis quisquam sit ullam ut?
        </CommentBubble>
      </div>
    </div>
  }

  async componentDidMount() {

    this.userId = await localForage.getItem('user_id')

    if (!this.userId) {
      this.userId = (Math.random() * 9999999).toString(36)
      await localForage.setItem('user_id', this.userId)
    }

    this.gun = Gun('https://government.browser.town/gun')
    // @ts-ignore
    global.gun = this.gun

    // Do this so it logs in the ambient console properly after first mount
    setTimeout(() => {
      ac.log("~~~ HELLO THERE ~~~")
      ac.log("Browser Town v0.0.35")
      ac.log("Setting up GUN connections")

      this.gun.on('auth', function () {
        ac.log('Authenticated', arguments)
      })

      this.gun.get('init', data => {
        ac.log("Updating initial payload...")

      }).open().then((data, key) => {
        ac.log("Updated init data", key, data)

      }).then(() => {
        ac.log("Loading profile...")
        let user = this.gun.user()
        user.recall({sessionStorage: true});
      })
    })

    this.gun.get('cursors').map().on((data, clientId) => {
      if (clientId == this.userId) {
        return
      }
      this.setState({
        ghostCursors: {
          ...this.state.ghostCursors,
          [clientId]: data
        }
      })
    })
  }

  getCanvasTransform(): CSSProperties {
    let {scale, offset: [x, y]} = this.state.canvas

    return {
      transformOrigin: "0px 0px 0px",
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
    this.gun.get('cursors').get(this.userId).put({clientX, clientY})
  }
}
