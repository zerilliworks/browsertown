import * as React from 'react'
import App, { Container } from 'next/app'
import AmbientConsole from "../interface/AmbientConsole";
import '../css/app.css'


export default class MyApp extends App {
  constructor(props) {
    super(props)
  }

  static async getInitialProps({ Component, router, ctx }) {
    let pageProps = {}

    if (Component.getInitialProps) {
      pageProps = await Component.getInitialProps(ctx)
    }

    return { pageProps }
  }

  render () {
    const { Component, pageProps } = this.props

    return (
      <Container>
        <Component {...pageProps} />
        <AmbientConsole maxLength={10}/>
      </Container>
    )
  }
}
