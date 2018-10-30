import * as React from 'react'

function SimpleText({useState}) {
  const [state, setState] = useState({text: ""})
  return <textarea value={state.text} onChange={e => setState({text: e.target.value})}/>
}

export default Entity()
