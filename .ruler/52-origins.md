# Origin Normalization

1. Treat `Origin`/`Referer` as **browser-only**; non-browser clients must use an explicit header (e.g. `expo-origin`) for origin-like metadata.
2. Normalize custom origin headers to a scheme origin (`alfred://`, `exp://`, `https://host`) before passing requests to strict origin validators.
3. In non-production, surface origin diagnostics via **response headers**, not by rewriting response bodies.

