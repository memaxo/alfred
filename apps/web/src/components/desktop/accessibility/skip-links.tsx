/**
 * Skip Links - Accessibility navigation shortcuts
 *
 * Provides skip links for keyboard users to jump to main content areas.
 */

import { createSkipLinks } from "@/lib/accessibility";

export function SkipLinks() {
  const skipLinks = createSkipLinks();

  return (
    <div className="sr-only focus-within:not-sr-only">
      <nav aria-label="Skip links" className="fixed top-0 left-0 z-[9999]">
        <ul className="flex gap-2 bg-void p-2">
          <li>
            <button
              className="rounded bg-biolum px-4 py-2 font-medium text-void focus:outline-none focus:ring-2 focus:ring-white"
              onClick={skipLinks.skipToMain}
              type="button"
            >
              Skip to main content
            </button>
          </li>
          <li>
            <button
              className="rounded bg-biolum px-4 py-2 font-medium text-void focus:outline-none focus:ring-2 focus:ring-white"
              onClick={skipLinks.skipToNav}
              type="button"
            >
              Skip to navigation
            </button>
          </li>
          <li>
            <button
              className="rounded bg-biolum px-4 py-2 font-medium text-void focus:outline-none focus:ring-2 focus:ring-white"
              onClick={skipLinks.skipToSearch}
              type="button"
            >
              Skip to search
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
