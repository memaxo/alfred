export function hello(name: string) {
  [name].forEach(() => {});
  return `hello ${name}`;
}
