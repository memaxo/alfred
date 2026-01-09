import type { PhysiologyState } from "../../subscriptions/cognitive";
import { colors } from "../../theme";
import { dim, fg, progressBar, truncate } from "../../typography";

export function renderPhysiologyIndicators(
  physiology: PhysiologyState,
  width: number
): string[] {
  const barWidth = Math.max(8, Math.min(26, width - 22));
  const energy = Math.max(0, Math.min(1, physiology.energy));
  const boredom = Math.max(0, Math.min(1, physiology.boredom));
  const frustration = Math.max(0, Math.min(1, physiology.frustration));

  const energyBar = progressBar(energy, barWidth, { color: colors.success });
  const boredomBar = progressBar(boredom, barWidth, { color: colors.warning });
  const frusBar = progressBar(frustration, barWidth, { color: colors.error });

  return [
    `  ${dim("Energy:")}       ${energyBar} ${fg(colors.success)(`${Math.round(energy * 100)}%`)}`,
    `  ${dim("Boredom:")}      ${boredomBar} ${fg(colors.warning)(`${Math.round(boredom * 100)}%`)}`,
    `  ${dim("Frustration:")}  ${frusBar} ${fg(colors.error)(`${Math.round(frustration * 100)}%`)}`,
  ];
}

export function renderPhysiologyStatus(physiology: PhysiologyState): string {
  const energy = physiology.energy;
  const boredom = physiology.boredom;
  const frustration = physiology.frustration;

  if (frustration > 0.6) {
    return fg(colors.error)(
      "  High frustration — reduce tool retries / simplify steps"
    );
  }
  if (boredom > 0.6) {
    return fg(colors.warning)(
      "  Boredom rising — consider batching / fewer prompts"
    );
  }
  if (energy < 0.4) {
    return fg(colors.warning)("  Low energy — prefer short, low-risk actions");
  }
  return fg(colors.success)("  Stable physiology");
}

export function renderPhysiology(
  physiology: PhysiologyState,
  width: number
): string {
  const w = Math.max(10, width);
  const energy = Math.max(0, Math.min(1, physiology.energy));
  const boredom = Math.max(0, Math.min(1, physiology.boredom));
  const frustration = Math.max(0, Math.min(1, physiology.frustration));

  const parts = [
    `${dim("E")}${fg(colors.success)(`${Math.round(energy * 100)}%`)}`,
    `${dim("B")}${fg(colors.warning)(`${Math.round(boredom * 100)}%`)}`,
    `${dim("F")}${fg(colors.error)(`${Math.round(frustration * 100)}%`)}`,
  ];

  return truncate(`${dim("  Physiology:")} ${parts.join(dim("  "))}`, w);
}
