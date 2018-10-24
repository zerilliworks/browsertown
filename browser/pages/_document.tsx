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
          <script type="text/javascript" dangerouslySetInnerHTML={{__html: `
          var _gauges = _gauges || [];
            (function() {
            var t   = document.createElement('script');
            t.type  = 'text/javascript';
            t.async = true;
            t.id    = 'gauges-tracker';
            t.setAttribute('data-site-id', '5bd0847cfd6d0d15889bd580');
            t.setAttribute('data-track-path', 'https://track.gaug.es/track.gif');
            t.src = 'https://d2fuc4clr7gvcn.cloudfront.net/track.js';
            var s = document.getElementsByTagName('script')[0];
            s.parentNode.insertBefore(t, s);
          })();
          `}}>
          </script>
        </body>
      </html>
    )
  }
}
