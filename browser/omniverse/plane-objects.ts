import * as React from "react";
import {v4 as uuid} from 'uuid'
import {PeerUUID} from "./peer";
import {EventEmitter2} from "eventemitter2";

/*
 * Notes on Reducers:
 *
 * Reducers should have the following properties:
 *
 * 1. Identity - If a Reducer receives a valid state and no/unknown action, it
 *    must return the same state unaltered.
 * 2. Initialization - If a reducer receives a state of `null`, it must return
 *    a valid initial state.
 * 3. Purity - If a reducer is called multiple times with the same state and
 *    action, it must always return the same result (we're a little flexible
 *    on this one, but it helps)
 */

interface IPlaneObject<State> {
  id: string
  owner: PeerUUID
  component: React.SFC
  reducer: (state: State | null, action: any) => State
  position: { x: number, y: number }
  state: State

  dispatch(action: string, ...args: any[]): void
}

type PlaneObjectConstructorOptions<T> = {
  initialState?: T,
  id?: IPlaneObject<T>["id"],
  position?: IPlaneObject<T>["position"]
};

export class PlaneObject<T> implements IPlaneObject<T> {
  private _component: React.SFC;
  private _id: string;
  owner: PeerUUID;
  readonly reducer: (state: T | null, action?: any) => T;
  private _state: T;
  position: { x: number; y: number };

  constructor(
    component: IPlaneObject<T>["component"],
    owner: IPlaneObject<T>["owner"],
    reducer: IPlaneObject<T>["reducer"],
    options: PlaneObjectConstructorOptions<T> = {}
  ) {
    this._id = options.id || uuid()
    this._component = component
    this.owner = owner
    this.reducer = reducer
    this._state = options.initialState || this.reducer(null)
    this.position = options.position || {x: 0, y: 0}
  }

  get id(): string {
    return this._id;
  }

  get component(): React.SFC {
    return this._component;
  }

  get state(): T {
    return this._state;
  }

  dispatch(action: string, ...args: any[]): void {
    if (args.length === 1 && typeof args[0] === 'object') {
      // Dispatch with object as args
      this._state = this.reducer(this._state, {TYPE: action, ...args[0]})
    }
  }
}

type IPlaneObjectCursor = Record<string, IPlaneObject<any>> & {
  map(iterator: (ob: IPlaneObject<any>, key: string) => any): any
}

export function PlaneObjectCursor(objects: Record<string, IPlaneObject<any>>): IPlaneObjectCursor {
  let objectCursor = Object.create(objects)
  objectCursor.map = (iterator: (ob: IPlaneObject<any>, key: string) => any) => {
    return Object.keys(objects).map(key => iterator(objects[key], key))
  }
  return objectCursor
}

export default class PlaneObjects {
  get events(): EventEmitter2 {
    return this._events;
  }
  private _objects: Record<string, IPlaneObject<any>>
  private _events: EventEmitter2;

  constructor(initialObjects?: IPlaneObject<any>[]) {
    this._objects = {}
    if (initialObjects) {
      initialObjects.map(io => this._objects[io.id] = io)
    }
    this._events = new EventEmitter2()
  }

  get objects(): IPlaneObjectCursor {
    return PlaneObjectCursor(this._objects)
  }

  add(po: IPlaneObject<any>) {
    this._objects[po.id] = po
  }
}
