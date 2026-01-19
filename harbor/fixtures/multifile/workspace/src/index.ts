import { partA } from "./a";
import { partB } from "./b";
import { partC } from "./c";

export function combined() {
  // Intentional bug: wrong order.
  return `${partA()}${partC()}${partB()}`;
}
