import { partA } from "./a";
import { partB } from "./b";
import { partC } from "./c";

export function combined() {
  return `${partA()}${partB()}${partC()}`;
}
