/**
 * Border-radius tiers — values come from `--radius` in index.css via tailwind.config.js:
 * rounded-lg = var(--radius), md = -2px, sm = -4px.
 *
 * | Export          | Role                                      |
 * |-----------------|-------------------------------------------|
 * | radiusChip      | badges, score chip, small tags            |
 * | radiusControl   | buttons, inputs, chat bubbles, hit areas  |
 * | radiusSurface   | nested cards, explorers, upload zones     |
 * | radiusPanel     | primary detail panel on gray canvas       |
 * | radiusPill      | spinners, avatars, circular count pills   |
 *
 * App shell (header, sidebar, main column) stays square — no radius class.
 * Sidebar list rows and job groups stay square — no radius class.
 */
export const radiusChip = 'rounded-sm';
export const radiusControl = 'rounded-md';
export const radiusSurface = 'rounded-lg';
/** Same token as radiusSurface; use for JobDetail, ActivityLogs, candidate dashboards. */
export const radiusPanel = radiusSurface;
export const radiusPill = 'rounded-full';

export const panelShellClass = `${radiusPanel} overflow-hidden border border-gray-200 dark:border-line bg-white dark:bg-surface shadow-elev-1`;
