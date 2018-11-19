import {Observable, Observer} from 'rxjs'

type EventReEmitter = () => void

export function makeReactable<T>(obj: T, eventBindings: (emit: EventReEmitter) => void): Observable<T> {
  return Observable.create(function(observer: Observer<T>) {
    const ee = () => observer.next(obj)
    eventBindings(ee)
  })
}

export interface ReactableEvent<E extends string, P, I = P> {
  event: E,
  payload: P,
  instance: I
}