import * as React from 'react'

export interface IShoutProps {
  color: string
  user: string
  pending: boolean
  content?: string
  position: { x: number, y: number }
  dispatch: (...args: any[]) => any
  children?: any[]
}

export default function Shout({color, user, pending, content, position, children, dispatch}: IShoutProps) {
  return (
    <div
      className={"rounded shadow w-32 p-4 bg-white z-10"}
      style={{position: 'absolute', top: position.y, left: position.x}}>
      {content}
      {children}
    </div>
  )
}

