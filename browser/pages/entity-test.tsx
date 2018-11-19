import * as React from 'react'
import Automerge from 'automerge'
import Omniverse from '../omniverse'
import {v4 as uuid} from 'uuid'

const TEST_PLANE = 'entity-test'
const omni = new Omniverse({trackerUrl: 'http://localhost:8765', autoPeer: true, plane: TEST_PLANE})
if (typeof window !== 'undefined') window.omni = omni

omni.on('peers.*.message.entity-update.*', (data, scope, fromPeer) => {
  console.log('Entity update: ', scope, fromPeer, data)
})

class Entity<P, S> extends React.Component<P, S> {
  private componentId: string

  constructor(props: any) {
    super(props)
    this.componentId = props.componentId || uuid()
  }

  setState(state: any, callback?: () => void): void {
    super.setState(state, () => this.emitStateUpdate())
  }

  componentDidMount() {
    omni.on(omni.scope('peers', '*', 'message', 'entity-update', this.componentId), (data, scope, fromPeer) => {
      console.log('entity update', data, scope, fromPeer)
      super.setState(data)
    })
  }

  emitStateUpdate() {
    const scope = omni.scope('entity-update', this.componentId)
    console.log("Emitting state change", scope, this.state)
    omni.plane(TEST_PLANE).broadcast(scope, this.state)
  }
}

class CountEntity extends Entity<{}, {count: number}> {
  constructor (props: {}) {
    super(props)
    this.state = {
      count: 0
    }
  }

  render() {
    return <button className="block p-2 m-2 bg-blue border border-blue-dark text-white rounded" onClick={() => this.increment()}>{this.state.count}</button>
  }

  private increment() {
    this.setState((state: any) => ({count: state.count + 1}))
  }
}

export default class extends React.Component {

  constructor (props) {
    super(props)

    this.state = {
      status: 'Booting...'
    }
  }

  componentDidMount () {
    omni.boot()
      .then(() => {
        this.setState({status: 'Ready'})
      })

    omni.on('reconnect_attempt', (tries) => {
      this.setState({status: 'Offline. Retrying... (' + tries + ')'})
    })

    omni.on('reconnect', () => {
      this.setState({status: 'Ready'})
    })
  }

  componentWillUnmount() {
    omni.offAll('reconnect')
    omni.offAll('reconnect_attempt')
  }

  render () {
    return (
      <div>
        <div>{this.state.status}</div>
        <CountEntity componentId={"countA"}/>
        <CountEntity componentId={"countB"}/>
        <CountEntity componentId={"countC"}/>
      </div>
    )
  }
}