import ConsoleInterceptor from "./console-interceptor";

const ambientConsole = new ConsoleInterceptor(global.console)

// @ts-ignore
global.ambientConsole = ambientConsole

export default ambientConsole
