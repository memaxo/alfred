export function add(a: number, b: number) {
  // Intentional bug for the eval: wrong operator.
  return a - b;
}

export function mul(a: number, b: number) {
  return a * b;
}
