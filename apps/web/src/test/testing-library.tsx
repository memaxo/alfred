import "./dom";
import type { ReactElement } from "react";

import {
  type RenderOptions,
  render as rtlRender,
} from "@testing-library/react";

import { DialogProvider } from "@/components/ui/dialog";

const render = (ui: ReactElement, options?: RenderOptions) =>
  rtlRender(<DialogProvider inline>{ui}</DialogProvider>, options);

export * from "@testing-library/react";
export { render };
