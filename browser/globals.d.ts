import AmbientConsole from "./interface/AmbientConsole";

declare global {
  var ambientConsole: AmbientConsole

  namespace NodeJS {
    interface Global {
      ambientConsole: AmbientConsole
    }
  }
}
