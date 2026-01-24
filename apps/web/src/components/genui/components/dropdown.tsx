/**
 * GenUI Dropdown Component
 *
 * Renders a dropdown select that integrates with TanStack Form.
 * This is an alias for the select component.
 */

import type { UIComponent } from "@alfred/type/genui";

import { GenUISelect } from "./select";

export function GenUIDropdown({ schema }: { schema: UIComponent }) {
  // Dropdown is functionally the same as select
  return <GenUISelect schema={schema} />;
}
