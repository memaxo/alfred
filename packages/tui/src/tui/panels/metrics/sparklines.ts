import { colors } from "../../theme";
import { dim, fg, sparkline as sparklineText } from "../../typography";

export function sparkline(
  values: number[],
  options: { width: number; color?: string }
): string {
  const slice = values.slice(-options.width);
  return sparklineText(slice, options.color ?? colors.primary);
}

export function labeledSparkline(
  label: string,
  values: number[],
  options: { width: number; color?: string }
): string {
  const color = options.color ?? colors.primary;
  const slice = values.slice(-options.width);
  const s = sparklineText(slice, color);
  return `${dim(label)} ${s}`;
}

export function renderSparklineWithStats(
  values: number[],
  options: { width: number; color?: string; unit?: string }
): string {
  const unit = options.unit ?? "";
  const slice = values.slice(-options.width);
  const min = slice.length ? Math.min(...slice) : 0;
  const max = slice.length ? Math.max(...slice) : 0;
  const last = slice.at(-1) ?? 0;
  const color = options.color ?? colors.primary;

  const s = sparklineText(slice, color);
  const stats = dim(
    `min ${Math.round(min)}${unit}  max ${Math.round(max)}${unit}  now ${Math.round(last)}${unit}`
  );
  return `${s}  ${fg(color)(stats)}`;
}
