export type CapabilityId = string & { readonly __brand: "CapabilityId" };

export type CapabilityRisk = "low" | "medium" | "high";

export interface CapabilityDescriptor {
  readonly id: CapabilityId;
  readonly title: string;
  readonly summary: string;
  readonly category: string;
  readonly risk: CapabilityRisk;
  readonly requiresAuth?: boolean;
  readonly requiresElevation?: boolean;
  readonly uiOnly?: boolean;
  readonly webWindowType?: string;
  readonly tags?: readonly string[];
}

export const asCapabilityId = (id: string) => id as CapabilityId;
