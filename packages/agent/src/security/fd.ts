import { dlopen, FFIType, ptr } from "bun:ffi";

const F_GETFD = 1;
const F_SETFD = 2;
const FD_CLOEXEC = 1;

type Libc = {
  fcntl: (fd: number, cmd: number, value: number) => number;
};

let libc: { symbols: Libc } | null = null;

function getLibc() {
  if (!libc) {
    libc = dlopen(null, {
      fcntl: {
        args: [FFIType.i32, FFIType.i32, FFIType.i32],
        returns: FFIType.i32,
      },
    });
  }
  return libc.symbols;
}

export function ensureFdInheritable(fd: number) {
  if (process.platform === "win32") {
    return;
  }
  const { fcntl } = getLibc();
  const current = fcntl(fd, F_GETFD, 0);
  if (current < 0) {
    return;
  }
  if (current & FD_CLOEXEC) {
    fcntl(fd, F_SETFD, current & ~FD_CLOEXEC);
  }
}

export function directoryFdPath(fd: number): string | null {
  if (process.platform === "linux") {
    return `/proc/self/fd/${fd}`;
  }
  if (process.platform === "darwin") {
    return `/dev/fd/${fd}`;
  }
  return null;
}
