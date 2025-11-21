declare module "@diffusionstudio/piper-wasm" {
  export type PiperModule = {
    callMain(args: string[]): number;
    FS: {
      writeFile(path: string, data: Uint8Array | string): void;
      readFile(path: string, opts?: { encoding: string }): any;
      unlink(path: string): void;
    };
  };
  export function createPiperPhonemize(options: {
    print: (data: any) => void;
    printErr: (data: any) => void;
    locateFile: (path: string) => string;
  }): Promise<PiperModule>;
}

declare module "piper-wasm" {
  export type PiperWasmModule = {
    callMain(args: string[]): number;
    FS: {
      writeFile(path: string, data: Uint8Array | string): void;
      readFile(path: string, opts?: { encoding: string }): any;
      unlink(path: string): void;
    };
  };
  export default function createPiper(options: {
    print: (data: any) => void;
    printErr: (data: any) => void;
    locateFile: (path: string) => string;
  }): Promise<PiperWasmModule>;
}
