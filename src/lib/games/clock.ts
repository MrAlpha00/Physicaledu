/** Isolated clock access keeps React components pure; ranked time is set on the server. */
export function clientNowMs(): number {
  return Date.now();
}
