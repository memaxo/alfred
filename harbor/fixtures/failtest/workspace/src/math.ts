export function add(a: number, b: number) {
  // Intentional bug for the eval: off-by-one.
  return a + b + 1;
}
