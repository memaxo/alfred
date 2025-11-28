#define _GNU_SOURCE
#include <errno.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

static void usage_error(const char *detail) {
  if (detail && detail[0] != '\0') {
    fprintf(stderr, "securespawn: %s\n", detail);
  } else {
    fprintf(stderr, "securespawn: missing ALFRED_CWD_FD or command\n");
  }
  _exit(125);
}

static void fatal_error(const char *prefix, int code) {
  if (prefix) {
    fprintf(stderr, "securespawn: %s: %s\n", prefix, strerror(errno));
  }
  _exit(code);
}

int main(int argc, char *argv[]) {
  const char *fd_env = getenv("ALFRED_CWD_FD");
  if (!fd_env || argc < 2) {
    usage_error("missing ALFRED_CWD_FD or command");
  }

  char *endptr = NULL;
  errno = 0;
  long parsed = strtol(fd_env, &endptr, 10);
  if (errno != 0 || endptr == fd_env || *endptr != '\0' || parsed <= 0 || parsed > INT_MAX) {
    usage_error("invalid ALFRED_CWD_FD value");
  }

  int dir_fd = (int)parsed;

  if (fchdir(dir_fd) != 0) {
    fatal_error("fchdir failed", 126);
  }

  unsetenv("ALFRED_CWD_FD");
  close(dir_fd);

  execvp(argv[1], &argv[1]);

  int code = (errno == ENOENT || errno == ENOTDIR) ? 127 : 126;
  fatal_error("exec failed", code);
  return code;
}
