/**
 * Generative UI Component Registry
 *
 * Dynamic component registration and resolution for generative UI.
 * Components are registered by name and resolved at render time.
 */

import type { ComponentType } from "react";

// biome-ignore lint/suspicious/noExplicitAny: Generic component registry requires flexible typing
type GenUIComponent = ComponentType<any>;

/**
 * Registry of components available for generative UI.
 */
const componentRegistry = new Map<string, GenUIComponent>();

/**
 * Register a component for generative UI.
 *
 * @param name - Component name (should match manifest naming)
 * @param component - React component to register
 */
export function registerComponent(
  name: string,
  component: GenUIComponent
): void {
  componentRegistry.set(name, component);
}

/**
 * Register multiple components at once.
 *
 * @param components - Map of name to component
 */
export function registerComponents(
  components: Record<string, GenUIComponent>
): void {
  for (const [name, component] of Object.entries(components)) {
    registerComponent(name, component);
  }
}

/**
 * Resolve a component by name.
 *
 * @param name - Component name to resolve
 * @returns The component or null if not found
 */
export function resolveComponent(name: string): GenUIComponent | null {
  return componentRegistry.get(name) ?? null;
}

/**
 * Check if a component is registered.
 *
 * @param name - Component name to check
 * @returns True if the component is registered
 */
export function hasComponent(name: string): boolean {
  return componentRegistry.has(name);
}

/**
 * Get all registered component names.
 *
 * @returns Array of registered component names
 */
export function getRegisteredComponents(): string[] {
  return Array.from(componentRegistry.keys());
}

/**
 * Unregister a component.
 *
 * @param name - Component name to unregister
 * @returns True if the component was removed
 */
export function unregisterComponent(name: string): boolean {
  return componentRegistry.delete(name);
}

/**
 * Clear all registered components.
 *
 * Primarily useful for testing.
 */
export function clearRegistry(): void {
  componentRegistry.clear();
}

/**
 * Get the number of registered components.
 */
export function registrySize(): number {
  return componentRegistry.size;
}
