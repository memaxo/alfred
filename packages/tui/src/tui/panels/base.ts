export type PanelRenderArgs = {
  state: unknown;
  width: number;
  height: number;
  focused: boolean;
};

export type BasePanel = {
  id: string;
  label: string;
  init?: () => void;
  subscribe: () => () => void;
  render: (args: PanelRenderArgs) => string | string[];
  onResize?: (width: number, height: number) => void;
  onFocus?: () => void;
  onBlur?: () => void;
};
