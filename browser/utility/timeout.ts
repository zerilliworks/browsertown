export default function timeout<T=any>(delay: number = 10000, error: T) {
  return new Promise<never>((resolve, reject) => {
    setTimeout(() => reject(error), delay)
  }).catch((): T => error)
}