export const colors = {
  background: '#0b0b0b',
  surface: '#161616',
  surfaceRaised: '#202020',
  border: '#2a2a2a',
  text: '#ffffff',
  textMuted: '#a7a7a7',
  textFaint: '#6b6b6b',
  accent: '#1ed760',
  accentPressed: '#1aa34a',
  danger: '#ff5c5c',
  warning: '#f5a524',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 4, md: 8, lg: 12, pill: 999 } as const;

export const font = {
  title: { fontSize: 26, fontWeight: '800' as const, color: colors.text },
  heading: { fontSize: 20, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  label: { fontSize: 13, color: colors.textMuted },
  small: { fontSize: 12, color: colors.textFaint },
};

/** Height of the mini player that sits above the tab bar; lists pad by this much. */
export const MINI_PLAYER_HEIGHT = 64;
