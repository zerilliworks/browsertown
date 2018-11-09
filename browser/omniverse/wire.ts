
type WireListener = (...args: any[]) => void


type WireSubscription = {
  call: () => void,
  off: () => void,
  id: number
}

type WireListenMethod = (event: string, listener: WireListener) => WireSubscription
type WireManyListenMethod = (event: string, times: number, listener: WireListener) => WireSubscription
type WireAllListenMethod = (listener: WireListener) => WireSubscription
type WireEmitMethod = (event: string, ...args: any[]) => void
type WireRemoveListenMethod = (event: string, listener: WireSubscription | number) => void

export interface IWireProtocol {
  wireNamespaceSeparator: string,
  addListener: WireListenMethod,
  removeListener: any,
  removeAllListeners: any,
  on: WireListenMethod,
  off: any,
  once: WireListenMethod,
  many: WireManyListenMethod,
  emit: WireEmitMethod,
  emitAsync: WireEmitMethod,
  onAny: WireAllListenMethod,
  offAny: any
}

export default class Wire {

}