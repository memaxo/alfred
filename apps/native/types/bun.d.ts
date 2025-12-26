declare module "bun:bundle" {
  export function feature(name: string): boolean;
  export const Registry: {
    features: string[];
  };
}
