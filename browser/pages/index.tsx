import '../css/app.css'

const DimensionBar = () => (
  <div
    className="flex flex-row items-stretch rounded-full my-4 mx-auto sm:w-full md:w-3/4 shadow bg-grey-lightest border">
    <input type="text" placeholder="Enter coordinates"
           className="flex flex-1 px-4 py-2 bg-transparent border-r hover:bg-grey-light border-grey-light hover:border-grey-dark rounded-l-full"/>
    <button className="flex flex-shrink flex-row items-center pl-3 pr-4 py-2 cursor-pointer bg-teal border-teal-dark hover:bg-teal-light focus:bg-teal-dark text-white font-bold rounded-r-full">
      ...or Create Dimension
    </button>
  </div>
)

const Index = () => (
  <div className="w-full h-full"
       style={{background: `url(/static/images/reticle-grid.svg)`}}>
    <div className={"container h-screen max-w-md mx-auto flex flex-col items-center justify-center text-center p-4"}>
      <img src="/static/images/browsertown.jpg"
           alt="Guy Fieri looking up and to the right with mouth open in an excited shouting pose, light bursting from his stylish sunglasses a the Firefox logo gleams in his eyes"
           className="rounded-full shadow-md border-4 border-white w-96 mb-4"/>
      <DimensionBar/>
    </div>
  </div>
)

export default Index
