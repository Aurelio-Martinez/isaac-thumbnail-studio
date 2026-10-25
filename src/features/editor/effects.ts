export const OUTLINE_MAX_RATIO = 0.06;
export const MIN_OUTLINE_WIDTH = 1;

/**
 * Outline width is stored in logical canvas pixels. On very small layers an
 * absolute width becomes disproportionately thick (a 4 px border on a 24 px
 * sprite is 1/6 of its edge). Cap the rendered width at 6% of the layer's
 * shorter side while keeping the user's requested value intact.
 */
export function effectiveOutlineWidth(requested: number, width: number, height: number): number {
  if (!(requested > 0)) return 0;
  const shortSide = Math.min(Math.max(1, width), Math.max(1, height));
  const cap = Math.max(MIN_OUTLINE_WIDTH, shortSide * OUTLINE_MAX_RATIO);
  return Math.max(MIN_OUTLINE_WIDTH, Math.min(requested, cap));
}
