declare module "agentfs-sdk" {
  export const AgentFS: {
    open(options: {
      id?: string;
      path?: string;
      base?: string;
    }): Promise<unknown>;
  };

  const _default: unknown;
  export default _default;
}
