/**
 * GenUI Detection Utilities Tests
 *
 * Tests form component detection and form ID extraction.
 */

import { describe, expect, it } from "bun:test";
import { containsFormComponents, extractFormId } from "../detect";
import type { UIComponent } from "@alfred/type/genui";

describe("detect", () => {
  describe("containsFormComponents", () => {
    it("detects form component at root", () => {
      const schema: UIComponent = {
        component: "text",
        props: {},
      };
      expect(containsFormComponents(schema)).toBe(true);
    });

    it("detects form component in children", () => {
      const schema: UIComponent = {
        component: "div",
        props: {},
        children: [
          {
            component: "text",
            props: {},
          },
        ],
      };
      expect(containsFormComponents(schema)).toBe(true);
    });

    it("detects nested form components", () => {
      const schema: UIComponent = {
        component: "div",
        props: {},
        children: [
          {
            component: "section",
            props: {},
            children: [
              {
                component: "select",
                props: {},
              },
            ],
          },
        ],
      };
      expect(containsFormComponents(schema)).toBe(true);
    });

    it("returns false for non-form components", () => {
      const schema: UIComponent = {
        component: "chart",
        props: {},
      };
      expect(containsFormComponents(schema)).toBe(false);
    });

    it("returns false for nested non-form components", () => {
      const schema: UIComponent = {
        component: "div",
        props: {},
        children: [
          {
            component: "chart",
            props: {},
          },
          {
            component: "grid",
            props: {},
          },
        ],
      };
      expect(containsFormComponents(schema)).toBe(false);
    });

    it("detects all form component types", () => {
      const formTypes = [
        "text",
        "select",
        "date",
        "daterange",
        "checkbox",
        "choice",
        "autocomplete",
        "dropdown",
      ];

      for (const type of formTypes) {
        const schema: UIComponent = {
          component: type,
          props: {},
        };
        expect(containsFormComponents(schema)).toBe(true);
      }
    });

    it("handles empty children array", () => {
      const schema: UIComponent = {
        component: "div",
        props: {},
        children: [],
      };
      expect(containsFormComponents(schema)).toBe(false);
    });

    it("handles missing children", () => {
      const schema: UIComponent = {
        component: "div",
        props: {},
      };
      expect(containsFormComponents(schema)).toBe(false);
    });
  });

  describe("extractFormId", () => {
    it("extracts formId from props", () => {
      const schema: UIComponent = {
        component: "text",
        props: {
          formId: "my-form-123",
        },
      };
      expect(extractFormId(schema)).toBe("my-form-123");
    });

    it("generates formId from component and key", () => {
      const schema: UIComponent = {
        component: "text",
        props: {},
        key: "name-field",
      };
      const formId = extractFormId(schema);
      expect(formId).toBe("form-text-name-field");
    });

    it("generates formId from component only when key missing", () => {
      const schema: UIComponent = {
        component: "select",
        props: {},
      };
      const formId = extractFormId(schema);
      expect(formId).toBe("form-select-default");
    });

    it("prefers formId prop over generated ID", () => {
      const schema: UIComponent = {
        component: "text",
        props: {
          formId: "explicit-id",
        },
        key: "should-be-ignored",
      };
      expect(extractFormId(schema)).toBe("explicit-id");
    });

    it("handles empty formId prop", () => {
      const schema: UIComponent = {
        component: "text",
        props: {
          formId: "",
        },
      };
      // Empty string should fall back to generation
      const formId = extractFormId(schema);
      expect(formId).toBe("form-text-default");
    });

    it("handles non-string formId prop", () => {
      const schema: UIComponent = {
        component: "text",
        props: {
          formId: 123, // Invalid type
        },
      };
      // Should fall back to generation
      const formId = extractFormId(schema);
      expect(formId).toBe("form-text-default");
    });
  });
});
