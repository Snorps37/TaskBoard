// Themes are four colors (background, cards, text, accent). Everything else is derived in app.css.
export const PRESETS = [
  { id: 'midnight', name: 'Midnight', bg: '#0d0f14', surface: '#14171e', text: '#e8eaf0', accent: '#8b9cff' },
  { id: 'serika', name: 'Serika Dark', bg: '#323437', surface: '#2c2e31', text: '#d1d0c5', accent: '#e2b714' },
  { id: 'nord', name: 'Nord', bg: '#2e3440', surface: '#3b4252', text: '#eceff4', accent: '#88c0d0', danger: '#bf616a' },
  { id: 'dracula', name: 'Dracula', bg: '#21222c', surface: '#282a36', text: '#f8f8f2', accent: '#bd93f9', danger: '#ff5555' },
  { id: 'gruvbox', name: 'Gruvbox', bg: '#1d2021', surface: '#282828', text: '#ebdbb2', accent: '#fabd2f', danger: '#fb4934' },
  { id: 'catppuccin', name: 'Catppuccin', bg: '#11111b', surface: '#1e1e2e', text: '#cdd6f4', accent: '#cba6f7', danger: '#f38ba8' },
  { id: 'tokyo', name: 'Tokyo Night', bg: '#16161e', surface: '#1a1b26', text: '#c0caf5', accent: '#7aa2f7', danger: '#f7768e' },
  { id: 'rosepine', name: 'Rose Pine', bg: '#191724', surface: '#1f1d2e', text: '#e0def4', accent: '#c4a7e7', danger: '#eb6f92' },
  { id: 'solarized', name: 'Solarized Dark', bg: '#002b36', surface: '#073642', text: '#93a1a1', accent: '#2aa198', danger: '#dc322f' },
  { id: 'forest', name: 'Forest', bg: '#0f1a14', surface: '#16241c', text: '#dfe9e1', accent: '#7ed99a' },
  { id: 'sunset', name: 'Sunset', bg: '#1f1620', surface: '#2a1c2b', text: '#ffe9d6', accent: '#ff8a5c' },
  { id: 'paper', name: 'Paper', bg: '#f3f4f7', surface: '#ffffff', text: '#1c1f2a', accent: '#4f5bd5', danger: '#d93a49' },
  { id: 'solarized-light', name: 'Solarized Light', bg: '#fdf6e3', surface: '#eee8d5', text: '#586e75', accent: '#268bd2', danger: '#dc322f' }
];

// Relative luminance (WCAG) of a #rrggbb color.
function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function themeVars(t) {
  const dark = luminance(t.bg) < 0.35;
  const L = luminance(t.accent);
  const darkText = '#0b0d16';
  // Text on the accent color: whichever of near-black or white contrasts more.
  const whiteContrast = 1.05 / (L + 0.05);
  const darkContrast = (L + 0.05) / (luminance(darkText) + 0.05);
  return {
    '--bg': t.bg,
    '--surface': t.surface,
    '--text': t.text,
    '--accent': t.accent,
    '--danger': t.danger ?? (dark ? '#ff6b7a' : '#d93a49'),
    '--on-accent': whiteContrast > darkContrast ? '#ffffff' : darkText,
    '--chip-mix': dark ? 'white' : 'black',
    'color-scheme': dark ? 'dark' : 'light'
  };
}

export function applyTheme(t) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(themeVars(t))) root.style.setProperty(k, v);
  try {
    localStorage.setItem('taskboard-theme-cache', JSON.stringify(t)); // so the next launch paints the right colors immediately
  } catch {
    // storage unavailable: ignore
  }
}

export function resolveTheme(settings) {
  return (
    settings.customThemes.find((t) => t.id === settings.theme) ??
    PRESETS.find((p) => p.id === settings.theme) ??
    PRESETS[0]
  );
}
