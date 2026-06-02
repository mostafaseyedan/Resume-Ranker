import React from 'react';

/** Monday.com status/group color → hex (board UI). */
export const MONDAY_COLOR_MAP: Record<string, string> = {
  black: '#000000',
  white: '#FFFFFF',
  red: '#e2445c',
  orange: '#fdab3d',
  yellow: '#ffcb00',
  green: '#00c875',
  'bright-green': '#9cd326',
  aquamarine: '#00d647',
  blue: '#579BFC',
  'dark-blue': '#0073ea',
  purple: '#a25ddc',
  pink: '#ff158a',
  lipstick: '#ff5ac4',
  'dark-purple': '#784bd1',
  indigo: '#6161FF',
  cyan: '#66ccff',
  'done-green': '#00c875',
  bright_green: '#9cd326',
  'dark-indigo': '#401694',
  navy: '#1f76c2',
  lavender: '#9aadff',
  lilac: '#a1a1ff',
  peach: '#ffadad',
  done_green: '#00c875',
  working_orange: '#fdab3d',
  stuck_red: '#e2445c',
  'chili-blue': '#66ccff',
};

export const MONDAY_COLORS = {
  BLUE: '#579BFC',
} as const;

/** var_name / token → hex for Vibe label overrides. */
export const MONDAY_HEXES: Record<string, string> = {
  grey: '#c4c4c4',
  'trolley-grey': '#757575',
  winter: '#9aadbd',
  'purple-gray': '#9d99b9',
  'old-rose': '#cd9282',
  royal: '#784bd1',
  'stuck-red': '#df2f4a',
  'done-green': '#00c875',
  river: '#007eb5',
  sky: '#216edf',
  'working-orange': '#fdab3d',
  working_orange: '#fdab3d',
  berry: '#cd9282',
  'green-shadow': '#00c875',
  'red-shadow': '#df2f4a',
  'lime-green': '#9cd326',
  'light-pink': '#ff5ac4',
  'grass-green': '#9cd326',
  purple: '#a25ddc',
  purple_gray: '#9d99b9',
  old_rose: '#cd9282',
};

export const MONDAY_TO_VIBE_COLOR_MAP: Record<string, string> = {
  'green-shadow': 'done-green',
  'grass-green': 'grass_green',
  'lime-green': 'saladish',
  orange: 'working_orange',
  'dark-orange': 'dark-orange',
  yellow: 'egg_yolk',
  mustered: 'tan',
  'red-shadow': 'stuck-red',
  'dark-red': 'dark-red',
  'dark-pink': 'sofia_pink',
  'light-pink': 'pink',
  'dark-purple': 'dark_purple',
  dark_indigo: 'dark_indigo',
  purple: 'purple',
  'bright-blue': 'bright-blue',
  'blue-links': 'river',
  sky: 'sky',
  navy: 'navy',
  australia: 'aquamarine',
  grey: 'american_gray',
  'trolley-grey': 'american_gray',
  'soft-black': 'blackish',
  'dark-grey': 'american_gray',
  gray: 'american_gray',
  'wolf-gray': 'american_gray',
  stone: 'american_gray',
  sunset: 'sunset',
  winter: 'winter',
  sail: 'winter',
  eden: 'teal',
  old_rose: 'berry',
};

export const COLOR_OVERRIDES: Record<string, string> = {
  grey: 'american_gray',
  'trolley-grey': 'steel',
  winter: 'winter',
  purple_gray: 'lavender',
  old_rose: 'berry',
  'dark-purple': 'royal',
  'red-shadow': 'stuck-red',
  'green-shadow': 'done-green',
  'blue-links': 'river',
  sky: 'sky',
  orange: 'working_orange',
};

export const STATIC_VAR_NAME_MAP: Record<string, string> = {
  open: 'sky',
  submitted: 'green-shadow',
  won: 'lime-green',
  'in progress': 'orange',
  interviewing: 'light-pink',
  analysis: 'dark-purple',
  'closed - filled': 'red-shadow',
  closed: 'old_rose',
  hold: 'grey',
  'not pursuing': 'trolley-grey',
  'not won': 'dark-orange',
  monitor: 'sunset',
  onsite: 'orange',
  remote: 'green-shadow',
  hybrid: 'purple',
  uk: 'blue-links',
  europe: 'australia',
  'latin america': 'grass-green',
  'part-time': 'blue-links',
  consultant: 'grey',
  'full-time': 'winter',
  'contract-to-hire': 'purple',
};

export function getGroupColorFromVar(colorName?: string | null): string {
  if (!colorName) return MONDAY_COLORS.BLUE;
  const normalized = colorName.toLowerCase().replace(/_/g, '-');
  return (
    MONDAY_COLOR_MAP[normalized] ||
    MONDAY_HEXES[normalized] ||
    MONDAY_HEXES[colorName] ||
    (colorName.startsWith('#') ? colorName : MONDAY_COLORS.BLUE)
  );
}

export function getVibeLabelColor(text: string, dynamicVarName?: string): string {
  if (dynamicVarName) {
    const normalizedVar = dynamicVarName.toLowerCase().replace(/_/g, '-');
    if (COLOR_OVERRIDES[normalizedVar]) return COLOR_OVERRIDES[normalizedVar];
    if (MONDAY_TO_VIBE_COLOR_MAP[normalizedVar]) return MONDAY_TO_VIBE_COLOR_MAP[normalizedVar];
  }

  if (!text) return 'american_gray';
  const normalizedText = text.toLowerCase().trim();

  let varName = STATIC_VAR_NAME_MAP[normalizedText];

  if (!varName) {
    if (normalizedText.includes('open')) varName = 'sky';
    else if (normalizedText.includes('submit')) varName = 'green-shadow';
    else if (normalizedText.includes('won') && !normalizedText.includes('not')) varName = 'lime-green';
    else if (normalizedText.includes('interview')) varName = 'light-pink';
    else if (normalizedText.includes('hold')) varName = 'grey';
    else if (normalizedText.includes('not pursuing')) varName = 'trolley-grey';
    else if (normalizedText.includes('closed')) varName = 'old_rose';
  }

  if (varName) {
    if (COLOR_OVERRIDES[varName]) return COLOR_OVERRIDES[varName];
    if (MONDAY_TO_VIBE_COLOR_MAP[varName]) return MONDAY_TO_VIBE_COLOR_MAP[varName];
  }

  return 'american_gray';
}

/** Injects Vibe token CSS variables for exact Monday hex matches. Mount once per app shell. */
export const MondayColorStyles: React.FC = () => {
  const css = Object.entries(COLOR_OVERRIDES)
    .map(([varName, token]) => {
      const normalizedVar = varName.toLowerCase().replace(/_/g, '-');
      const normalizedToken = token.toLowerCase().replace(/_/g, '-');
      let hex = MONDAY_HEXES[normalizedVar] || MONDAY_HEXES[varName];
      if (!hex && (MONDAY_HEXES[normalizedToken] || MONDAY_HEXES[token])) {
        hex = MONDAY_HEXES[normalizedToken] || MONDAY_HEXES[token];
      }
      if (hex) {
        return `--color-${token}: ${hex}; --color-${token}-hover: ${hex}; --color-${token}-selected: ${hex};`;
      }
      return '';
    })
    .join('\n');

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `:root { ${css} }`,
      }}
    />
  );
};
