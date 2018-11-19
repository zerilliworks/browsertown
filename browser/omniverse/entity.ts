import * as React from 'react'
import {Component} from 'react'

type EntityConfiguration = any

export default class Entity {
  private component: Component

  constructor(configuration: EntityConfiguration) {
    this.component = configuration.component
  }

  render() {
    let Component = this.component
    return <Component {...this.internalProps}/>
  }

}

export function createEntity(component: React.Component, initialProps: any = {}, initialState: any = {}) {
  return new Entity({component, initialState, initialProps})
}