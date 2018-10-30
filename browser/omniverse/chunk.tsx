import * as React from "react";
import {broadcastState} from "./broadcast";

class Chunk {
  entities: any[]
  inhabitants: any[]
  plane: number
  coordinates: [number, number]
  bounds: [number, number]

}

class Entity {
  id: any
  chunk: any
  component: any
  state: any
  sequence: number
  props: any
  owner?: any
  shared: boolean
  coordinates: [number, number]
  bounds?: [number, number]

  constructor(props) {
    this.id = uuid()
    this.props = props
    this.sequence = 1
  }

  render() {
    const Component = this.component
    const [x, y] = this.localCoordinates

    return <div style={{
      transform: `translate(${x}px, ${y}px)`
    }}>
      <Component {...this.props} useState={this.componentStateConstructor()} />
    </div>
  }

  setState(newState) {
    this.sequence++
    let changes = this.diff(this.state, newState)
    this.applyStateChange(changes)
    broadcastState(uuid, this.sequence, changes)
  }

  get localCoordinates() {
    return this.coordinates
  }

  get globalCoordinates() {
    let chunk = this.chunk
    let coord = this.coordinates
    return [chunk[0] + coord[0], chunk[1] + coord[1]]
  }

  private diff(a, b) {
    return {}
  }

  private applyStateChange(changes: {}) {
    this.state = merge(this.state, changes)
  }

  // Higher-order function that intercepts the setState event via the State hook
  // and notifies the entity that there is a state update to broadcast.
  private componentStateConstructor() {
    return (value) => {
      const [v, setv] = React.useState(value)
      return [v, (nextv) => {this.onChildStateChange(nextv), setv(nextv)}]
    }
  }

  private onChildStateChange(next: any) {

  }
}
