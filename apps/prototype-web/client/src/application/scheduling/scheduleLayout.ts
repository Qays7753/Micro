export const MONTH_DAY_COUNT = 7;
export const MONTH_GRID_GAP_PX = 4;
export const MIN_INTERACTIVE_DAY_TARGET_PX = 44;

export const MONTH_GRID_MIN_WIDTH_PX =
  MONTH_DAY_COUNT * MIN_INTERACTIVE_DAY_TARGET_PX + (MONTH_DAY_COUNT - 1) * MONTH_GRID_GAP_PX;

export function monthGridColumnWidth(viewportWidth: number, panelPaddingPx: number): number {
  const mainHorizontalPaddingPx = 32;
  const availableWidth = viewportWidth - mainHorizontalPaddingPx - panelPaddingPx * 2;
  return (availableWidth - (MONTH_DAY_COUNT - 1) * MONTH_GRID_GAP_PX) / MONTH_DAY_COUNT;
}
