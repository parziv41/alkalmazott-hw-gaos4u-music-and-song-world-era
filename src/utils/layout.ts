import type { Insets, Size } from './globe'

// Keep in sync with --panel-w in styles/index.css.
const PANEL_MIN = 380
const PANEL_MAX = 460
const PANEL_VW = 0.32
export const PANEL_MARGIN = 12

export const SHEET_PEEK = 0.46
export const SHEET_FULL = 0.92

export const DESKTOP_QUERY = '(min-width: 768px)'

const TOP_BAR = 64

export function panelWidth(viewportWidth: number): number {
  return Math.min(PANEL_MAX, Math.max(PANEL_MIN, viewportWidth * PANEL_VW))
}

/** Map area hidden behind floating UI, so the camera can frame countries in what stays visible. */
export function mapInsets(size: Size, isDesktop: boolean, panelOpen: boolean): Insets {
  if (isDesktop) {
    return {
      top: TOP_BAR,
      left: 24,
      bottom: 48,
      right: panelOpen ? panelWidth(size.width) + PANEL_MARGIN * 3 : 24,
    }
  }
  return { top: TOP_BAR, left: 12, right: 12, bottom: panelOpen ? size.height * SHEET_PEEK : 24 }
}
