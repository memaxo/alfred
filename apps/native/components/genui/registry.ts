import { Branch } from "./Branch";
import { Chart } from "./Chart";
import { Cite } from "./Cite";
import { Confirm } from "./Confirm";
import { Grid } from "./Grid";
import { List } from "./List";
import { Matrix } from "./Matrix";
import { Number } from "./Number";
import { Plan } from "./Plan";
import { Progress } from "./Progress";
import { Select } from "./Select";
import { Task } from "./Task";
import { Term } from "./Term";
import { Timeline } from "./Timeline";

export const GENUI_REGISTRY = {
  chart: Chart,
  grid: Grid,
  list: List,
  number: Number,
  matrix: Matrix,
  term: Term,
  progress: Progress,
  timeline: Timeline,
  confirm: Confirm,
  plan: Plan,
  task: Task,
  branch: Branch,
  cite: Cite,
  select: Select,
} as const;

export type GenUIComponentName = keyof typeof GENUI_REGISTRY;

export function isValidGenUIComponent(
  name: string
): name is GenUIComponentName {
  return name in GENUI_REGISTRY;
}

export function getGenUIComponent(name: string) {
  if (isValidGenUIComponent(name)) {
    return GENUI_REGISTRY[name];
  }
  return null;
}
