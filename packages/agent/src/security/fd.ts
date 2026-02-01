import { dlopen, FFIType, ptr } from "bun:ffi";
import { readlinkSync } from "node:fs";

const F_GETFD = 1;
const F_SETFD = 2;
const FD_CLOEXEC = 1;
const F_GETPATH = 50;

interface LibcSymbols {
  fcntl: (fd: number, cmd: number, value: bigint) => number;
}

let cachedLibc: { symbols: LibcSymbols } | null = null;

function getLibc(): LibcSymbols | null {
  if (process.platform === "win32") {
    return null;
  }

  if (!cachedLibc) {
    const libcPath =
      process.platform === "darwin"
        ? "libSystem.B.dylib"
        : (process.platform === "linux"
          ? "libc.so.6"
          : null);

    if (!libcPath) {
      return null;
    }

    cachedLibc = dlopen(libcPath, {
      fcntl: {
        args: [FFIType.i32, FFIType.i32, FFIType.i64],
        returns: FFIType.i32,
      },
    });
  }
  return cachedLibc.symbols;
}

export function ensureFdInheritable(fd: number) {
  const libc = getLibc();
  if (!libc) {
    return;
  }
  const current = libc.fcntl(fd, F_GETFD, 0n);
  if (current < 0) {
    return;
  }
  if (current & FD_CLOEXEC) {
    libc.fcntl(fd, F_SETFD, BigInt(current & ~FD_CLOEXEC));
  }
}

export function directoryFdPath(fd: number): string | null {
  switch (process.platform) {
    case "linux": {
      return `/proc/self/fd/${fd}`;
    }
    case "darwin": {
      return `/dev/fd/${fd}`;
    }
    default: {
      return null;
    }
  }
}

export function pathFromFd(fd: number): string | null {
  if (process.platform === "linux") {
    try {
      return readlinkSync(`/proc/self/fd/${fd}`);
    } catch {
      return null;
    }
  }

  if (process.platform === "darwin") {
    const libc = getLibc();
    if (!libc) {
      return null;
    }
    const buffer = Buffer.allocUnsafe(1024);
    const result = libc.fcntl(fd, F_GETPATH, BigInt(ptr(buffer)));
    if (result < 0) {
      return null;
    }
    const terminator = buffer.indexOf(0);
    return buffer.toString(
      "utf8",
      0,
      terminator !== -1 ? terminator : undefined
    );
  }

  return null;
}
