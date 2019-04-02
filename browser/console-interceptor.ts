
export interface IConsoleReceiver {
  clear(): void
  debug(message?: any): void
  error(message?: any): void
  exception(message?: any): void
  info(message?: any): void
  log(message?: any): void
  trace(message?: any): void
  warn(message?: any): void
}

enum ConsoleMethod {
  assert = 'assert',
  clear = 'clear',
  debug = 'debug',
  error = 'error',
  exception = 'exception',
  info = 'info',
  log = 'log',
  trace = 'trace',
  warn = 'warn'
}

export default class ConsoleInterceptor implements Console {
  Console: NodeJS.ConsoleConstructor;
  private receivers: IConsoleReceiver[];

  memory: any;
  private originalConsole: Console;

  constructor(originalConsole: Console) {
    this.originalConsole = originalConsole
    this.receivers = []
  }

  private informReceivers(method: ConsoleMethod, ...args: any[]) {
    for (let rec of this.receivers) {
      rec[method].apply(rec, args)
    }
  }

  // Ye cannae unsubscribe tho
  addReceiver(receiver: IConsoleReceiver) {
    this.receivers.push(receiver)
    console.log(this.receivers)
  }

  // Overridden methods
  assert(condition?: boolean, message?: string, ...data: any[]): void {
    this.originalConsole.assert(condition, message, data);
    this.informReceivers(ConsoleMethod.assert, message, ...data)
  }

  clear(): void {
    this.originalConsole.clear();
    this.informReceivers(ConsoleMethod.clear)
  }

  debug(message?: any, ...optionalParams: any[]): void {
    this.originalConsole.debug(message, optionalParams);
    this.informReceivers(ConsoleMethod.debug, message, ...optionalParams)
  }

  error(message?: any, ...optionalParams: any[]): void {
    this.originalConsole.error(message, optionalParams);
    this.informReceivers(ConsoleMethod.error, message, ...optionalParams)
  }

  exception(message?: string, ...optionalParams: any[]): void {
    this.originalConsole.exception(message, optionalParams);
    this.informReceivers(ConsoleMethod.exception, message, ...optionalParams)
  }

  info(message?: any, ...optionalParams: any[]): void {
    this.originalConsole.info(message, optionalParams);
    this.informReceivers(ConsoleMethod.info, message, ...optionalParams)
  }

  log(message?: any, ...optionalParams: any[]): void {
    this.originalConsole.log(message, optionalParams);
    this.informReceivers(ConsoleMethod.log, message, ...optionalParams)
  }

  trace(message?: any, ...optionalParams: any[]): void {
    this.originalConsole.trace(message, optionalParams);
    this.informReceivers(ConsoleMethod.trace, message, ...optionalParams)
  }

  warn(message?: any, ...optionalParams: any[]): void {
    this.originalConsole.warn(message, optionalParams);
    this.informReceivers(ConsoleMethod.warn, message, ...optionalParams)
  }


  // Passthru methods
  count(label?: string): void {
    return this.originalConsole.count.apply(this.originalConsole, arguments)
  }

  dir(value?: any, ...optionalParams: any[]): void {
    return this.originalConsole.dir.apply(this.originalConsole, arguments)
  }

  dirxml(value: any): void {
    return this.originalConsole.dirxml.apply(this.originalConsole, arguments)
  }

  group(groupTitle?: string, ...optionalParams: any[]): void {
    return this.originalConsole.group.apply(this.originalConsole, arguments)
  }

  groupCollapsed(groupTitle?: string, ...optionalParams: any[]): void {
    return this.originalConsole.groupCollapsed.apply(this.originalConsole, arguments)
  }

  groupEnd(): void {
    return this.originalConsole.groupEnd.apply(this.originalConsole, arguments)
  }

  markTimeline(label?: string): void {
    return this.originalConsole.markTimeline.apply(this.originalConsole, arguments)
  }

  msIsIndependentlyComposed(element: Element): boolean {
    // @ts-ignore
    return this.originalConsole.msIsIndependentlyComposed.apply(this.originalConsole, arguments)
  }

  profile(reportName?: string): void {
    return this.originalConsole.profile.apply(this.originalConsole, arguments)
  }

  profileEnd(): void {
    return this.originalConsole.profileEnd.apply(this.originalConsole, arguments)
  }

  select(element: Element): void {
    // @ts-ignore
    return this.originalConsole.select.apply(this.originalConsole, arguments)
  }

  table(...tabularData: any[]): void {
    return this.originalConsole.table.apply(this.originalConsole, arguments)
  }

  time(label?: string): void {
    return this.originalConsole.time.apply(this.originalConsole, arguments)
  }

  timeEnd(label?: string): void {
    return this.originalConsole.timeEnd.apply(this.originalConsole, arguments)
  }

  timeStamp(label?: string): void {
    return this.originalConsole.timeStamp.apply(this.originalConsole, arguments)
  }

  timeline(label?: string): void {
    return this.originalConsole.timeline.apply(this.originalConsole, arguments)
  }

  timelineEnd(label?: string): void {
    return this.originalConsole.timelineEnd.apply(this.originalConsole, arguments)
  }

  countReset(label?: string): void {
    return this.originalConsole.countReset.apply(this.originalConsole, arguments)
  }
  timeLog(label: string, ...data: any[]): void {
    return this.originalConsole.timeLog.apply(this.originalConsole, arguments)
  }

  clearReceivers() {
    this.receivers = []
  }
}
