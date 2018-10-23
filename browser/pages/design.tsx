import '../css/app.css'

import SearchBar from '../interface/SearchBar'
import * as React from "react";
import {CSSProperties, MouseEvent, WheelEvent} from "react";
import CommentBubble from "../interface/CommentBubble";

interface State {
  canvas: {
    offset: [number, number],
    scale: number
  },
  panning: boolean
}

interface Props {
}

export default class Design extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      canvas: {
        offset: [0.0, 0.0],
        scale: 1.0
      },
      panning: false
    }

    this.beginPan = this.beginPan.bind(this)
    this.endPan = this.endPan.bind(this)
    this.panCanvas = this.panCanvas.bind(this)
    this.scrollCanvas = this.scrollCanvas.bind(this)
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
                onMouseMove={this.panCanvas}
                onWheel={this.scrollCanvas}>
      <div className="fixed z-50 w-full pin-t"><SearchBar/></div>
      <div style={{...this.getCanvasTransform()}}
           className={"canvas-root w-full h-full"}>
        <CommentBubble author={"@dipshit"} color={"red"} avatarUrl={"https://placekitten.com/64/64"}
                       timestamp={"3m ago"}>
          Lorem ipsum dolor sit amet, consectetur adipisicing elit. Accusamus aperiam delectus est exercitationem hic
          illo
          libero nostrum qui saepe! Aliquam amet aperiam, delectus ipsa molestiae quis quisquam sit ullam ut?
        </CommentBubble>
      </div>
    </div>
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

  private panCanvas(event: MouseEvent) {
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
}
