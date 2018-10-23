import '../css/app.css'

import Link from 'next/link'

const Index = () => (
  <div className={"container h-screen max-w-sm mx-auto flex flex-col items-center justify-center text-center"}>
    <img src="/static/images/browsertown.jpg"
         alt="Guy Fieri looking up and to the right with mouth open in an excited shouting pose, light bursting from his stylish sunglasses a the Firefox logo gleams in his eyes"
         className="rounded-full shadow-md border-4 border-white w-4/5"/>
    <h1 className={"my-8"}>Welcome to Browser Town, baby</h1>
  </div>
)

export default Index
