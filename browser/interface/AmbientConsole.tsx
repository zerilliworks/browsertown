import {Component} from 'react'
import * as React from 'react'
import * as moment from 'moment'
import ambientConsole from '../ambient-console'
import eyes from 'eyes'
import {trim} from 'lodash'

export default class AmbientConsole extends Component<{maxLength: number}, {messages: Array<{ts: any, type: string, message: any}>}> {
  private inspector: any
  constructor(props) {
    super(props)

    this.inspector = eyes.inspector({
      stream: null,
      styles: false
    })

    this.state = {
      messages: []
    }
  }

  private formatVariadicLog(lines: any[]): string {
    return trim(lines.map(l => this.inspector(l)).join(' '), `'"`)
  }

  componentDidMount() {
    const self = this

    function update() {
      // @ts-ignore
      self.state.messages = self.state.messages.slice(self.props.maxLength * -1, self.props.maxLength)
      self.forceUpdate()
    }

    // @ts-ignore
    ambientConsole.addReceiver({
      clear() {},
      debug(...message) {
        self.state.messages.push({type: 'debug', ts: Date.now(), message: self.formatVariadicLog(message)})
        update()
      },
      error(...message) {
        self.state.messages.push({type: 'error', ts: Date.now(), message: self.formatVariadicLog(message)})
        update()
      },
      exception(...message) {
        self.state.messages.push({type: 'exception', ts: Date.now(), message: self.formatVariadicLog(message)})
        update()
      },
      info(...message) {
        self.state.messages.push({type: 'info', ts: Date.now(), message: self.formatVariadicLog(message)})
        update()
      },
      log(...message) {
        self.state.messages.push({type: 'log', ts: Date.now(), message: self.formatVariadicLog(message)})
        update()
      },
      trace(...message) {
        self.state.messages.push({type: 'trace', ts: Date.now(), message: self.formatVariadicLog(message)})
        update()
      },
      warn(...message) {
        self.state.messages.push({type: 'warn', ts: Date.now(), message: self.formatVariadicLog(message)})
        update()
      },
    })
  }

  componentWillUnmount() {
    // @ts-ignore
    ambientConsole.clearReceivers()
  }

  render() {
    return (
      <div className="fixed p-2 pin-b pin-l w-auto bg-transparent text-grey-light hover:text-grey-dark text-sm font-mono" style={{pointerEvents: 'none'}}>
        {this.state.messages.map(m => <p key={m.ts + m.message}>[{moment(m.ts).format()}]: {m.message}</p>)}
      </div>
    )
  }
}
