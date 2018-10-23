// _document is only rendered on the server side and not on the client side
// Event handlers like onClick can't be added to this file

// ./pages/_document.js
import Document, {Head, Main, NextScript} from 'next/document'

export default class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx)
    return {...initialProps}
  }

  render() {
    return (
      <html className={"m0 p0 w-full h-full"}>
        <Head/>
        <body className="m0 p0 w-full h-full overflow-hidden">
          <Main/>
          <NextScript/>
        </body>
      </html>
    )
  }
}
