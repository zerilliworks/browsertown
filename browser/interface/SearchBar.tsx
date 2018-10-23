export default props => (
  <div
    className="flex flex-row items-stretch rounded-full my-4 mx-auto w-3/4 shadow bg-grey-lightest border border-grey-lighter">
    <input type="text" placeholder="Find shit"
           className="flex flex-1 px-4 py-2 bg-transparent border-r border-grey-light"/>
    <div className="flex flex-shrink flex-row items-center px-2 py-2 cursor-pointer hover:bg-grey-light rounded-r-full">
      <h3 className="leading-tight mr-2">Armand is logged in</h3>
      <img className="rounded-full w-8 h-8" src="https://placekitten.com/32/32" alt="Avatar"/>
    </div>
  </div>
)
