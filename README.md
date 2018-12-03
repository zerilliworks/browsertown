# Browser Town
## A watering hole for your mouse cursor

I wanted to see what WebRTC was all about and had kind of a neat idea for how to 
build a P2P network of browsers, so this is a way to try that out.

Works like hot garbage right now, but I think the ideas are pretty good, so I'm 
gonna see where this goes.

## Prior Art & Inspirations
- Ephemeral P2P [https://github.com/losvedir/ephemeral2](https://github.com/losvedir/ephemeral2)
- Peer.js [https://peerjs.com/](https://peerjs.com/)
- Dat Project [https://github.com/datproject](https://github.com/datproject)
- Scuttlebutt [https://scuttlebutt.nz/](https://scuttlebutt.nz/)
- Edsu [https://edsu.org/](https://edsu.org/)

## A little background
I am working on the data distribution layer of this thing right now, something
that's tentatively called "The Omniverse." It's an API for P2P communication and
data storage.

It requires a central peer tracker server, which I've stubbed out, and 
individual connections to peers happen over WebRTC. There are some utilities for
sending and receiving data.

