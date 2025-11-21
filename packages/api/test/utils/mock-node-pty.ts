import { mock } from "bun:test";

mock.module("node-pty", () => ({
  spawn: () => ({
    on: () => {},
    write: () => {},
    resize: () => {},
    kill: () => {},
  }),
}));
