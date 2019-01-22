import * as React from 'react'
import App, {Container} from 'next/app'
import AmbientConsole from "../interface/AmbientConsole";
import '../css/app.css'

export const ConsoleContext = React.createContext({})
export const withConsoleControl = Component => props => <ConsoleContext.Consumer>
  {value => <Component console={value} {...props}/>}
</ConsoleContext.Consumer>

export default class MyApp extends App {
  state: {consoleVisible: boolean}

  constructor(props: any) {
    super(props)
    this.state = {
      consoleVisible: true
    }
  }

  static async getInitialProps({Component, router, ctx}) {
    let pageProps = {}

    if (Component.getInitialProps) {
      pageProps = await Component.getInitialProps(ctx)
    }

    return {pageProps}
  }

  render() {
    const {Component, pageProps} = this.props

    return (
      <ConsoleContext.Provider value={{toggle: this.toggleConsole.bind(this)}}>
        <Container>
          <Component {...pageProps} />
          <AmbientConsole maxLength={10} visible={this.state.consoleVisible}/>
        </Container>
      </ConsoleContext.Provider>
    )
  }

  toggleConsole() {
    console.log('toggle console')
    this.setState({consoleVisible: !this.state.consoleVisible})
  }
}
