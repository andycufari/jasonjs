// studio/core/utils/theme.js


const defaultTheme = {
  defaultColorScheme: 'light',
  colors: {
    // Brand colors
    primary: '#6366f1',
    secondary: '#8b5cf6',
    accent: '#10b981',

    // Base colors (light by default)
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#1e293b',
    textSecondary: '#64748b',
    textMuted: '#94a3b8',

    // Border colors
    border: '#e2e8f0',
    borderLight: '#f1f5f9',
    
    // Semantic colors
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    
    // Interactive colors
    hover: '#f1f5f9',
    focus: '#ddd6fe',
    active: '#e7e5e4'
  },
  typography: {
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    headings: {
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      fontWeight: '600',
      lineHeight: '1.2',
      sizes: {
        h1: '2.5rem',
        h2: '2rem',
        h3: '1.75rem',
        h4: '1.5rem',
        h5: '1.25rem',
        h6: '1rem'
      }
    },
    body: {
      fontSize: '16px',
      lineHeight: '1.6',
      fontWeight: '400'
    }
  },
  spacing: {
    containerMaxWidth: '1280px',
    containerPadding: '1rem',
    sectionPadding: '5rem',
    cardPadding: '1.5rem'
  },
  borders: {
    radius: {
      none: '0',
      sm: '0.25rem',
      base: '0.5rem', 
      md: '0.75rem',
      lg: '1rem',
      xl: '1.5rem',
      '2xl': '2rem',
      full: '9999px'
    },
    width: {
      thin: '1px',
      base: '2px',
      thick: '3px'
    }
  },
  shadows: {
    xs: '0 1px 2px rgba(0, 0, 0, 0.05)',
    sm: '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
    base: '0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)',
    md: '0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
    lg: '0 20px 25px rgba(0, 0, 0, 0.1), 0 10px 10px rgba(0, 0, 0, 0.04)',
    xl: '0 25px 50px rgba(0, 0, 0, 0.15)',
    '2xl': '0 50px 100px rgba(0, 0, 0, 0.25)'
  },
  darkMode: {
    colors: {
      primary: '#818cf8',
      secondary: '#a78bfa',
      accent: '#34d399',
      background: '#0f172a',
      surface: '#1e293b', 
      text: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#64748b',
      border: '#334155',
      borderLight: '#475569',
      success: '#34d399',
      warning: '#fbbf24',
      error: '#f87171',
      info: '#60a5fa',
      hover: '#334155',
      focus: '#4c1d95',
      active: '#44403c'
    }
  }
};


export function getTheme(pageTheme = {}, options = {}) {
  const shouldLog = options.shouldLog === true; // Default to true for backward compatibility

  //if (shouldLog) console.log('🎨 getTheme received:', JSON.stringify(pageTheme, null, 2));

  // Handle nested theme object (if pageTheme has a 'theme' property, unwrap it)
  if (pageTheme.theme && !pageTheme.colors && !pageTheme.defaultColorScheme) {
    pageTheme = pageTheme.theme;
    //if (shouldLog) console.log('🎨 Unwrapped nested theme:', JSON.stringify(pageTheme, null, 2));
  }

  // Helper function to check if value is an object
  const isObject = (item) => {
    return (item && typeof item === 'object' && !Array.isArray(item));
  };

  // Deep merge function to safely merge nested objects
  const deepMerge = (target, source) => {
    const output = {...target};
    if (isObject(target) && isObject(source)) {
      Object.keys(source).forEach(key => {
        if (isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  };

  // Auto-generate theme from minimal input (just primary/secondary)
  const generateAdaptiveTheme = (baseTheme) => {
    // Helper to extract hex from color (handles both string and palette object)
    const toHex = (color, fallback) => {
      if (!color) return fallback;
      if (typeof color === 'string' && color.startsWith('#')) return color;
      if (typeof color === 'object' && color !== null) {
        return color['500'] || color['600'] || color['DEFAULT'] || color['default'] ||
          Object.values(color).find(v => typeof v === 'string' && v.startsWith('#')) || fallback;
      }
      return fallback;
    };

    // Get primary and secondary as hex strings (normalized from palettes if needed)
    const primaryHex = toHex(baseTheme.colors?.primary, defaultTheme.colors.primary);
    const secondaryHex = toHex(baseTheme.colors?.secondary, defaultTheme.colors.secondary);

    // Detect if colors are light or dark to determine scheme
    const isLightColor = (hex) => {
      const validHex = toHex(hex, '#6366f1');
      const rgb = parseInt(validHex.slice(1), 16);
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = (rgb >> 0) & 0xff;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return luma > 128;
    };

    // Use explicit scheme if provided, otherwise default to light
    const autoScheme = baseTheme.defaultColorScheme || 'light';

    // Auto-generate complementary colors based on scheme
    const autoColors = autoScheme === 'dark' ? {
      background: '#0f1419',
      surface: '#1e2328',
      text: '#ffffff',
      textSecondary: '#d1d5db',
      textMuted: '#9ca3af',
      border: '#374151',
      borderLight: '#4b5563',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
      hover: '#374151',
      focus: primaryHex + '40', // Add opacity (using normalized hex)
      active: '#4b5563'
    } : {
      background: '#ffffff',
      surface: '#f8fafc',
      text: '#1e293b',
      textSecondary: '#64748b',
      textMuted: '#94a3b8',
      border: '#e2e8f0',
      borderLight: '#f1f5f9',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
      hover: '#f1f5f9',
      focus: primaryHex + '20', // Add opacity (using normalized hex)
      active: '#e7e5e4'
    };

    // Normalize all user colors - convert palette objects to hex strings
    const normalizedUserColors = {};
    if (baseTheme.colors) {
      for (const [key, value] of Object.entries(baseTheme.colors)) {
        // Skip palette objects (like primary: { 50: ..., 500: ... }) - they're handled above
        // Only keep simple string colors or extract hex from nested objects
        if (typeof value === 'string') {
          normalizedUserColors[key] = value;
        } else if (typeof value === 'object' && value !== null) {
          // It's a palette - extract main color only for core colors
          const coreColors = ['primary', 'secondary', 'accent', 'background', 'surface', 'text', 'border', 'success', 'warning', 'error', 'info'];
          if (coreColors.includes(key)) {
            normalizedUserColors[key] = toHex(value, autoColors[key] || '#6366f1');
          }
          // Skip non-core palette objects (like "cyber", "neutral") to avoid polluting theme
        }
      }
    }

    // Preserve original palette objects for generating shade classes
    const colorPalettes = {};
    if (baseTheme.colors) {
      for (const [key, value] of Object.entries(baseTheme.colors)) {
        if (typeof value === 'object' && value !== null) {
          // Check if it looks like a Tailwind palette (has numeric keys)
          const hasNumericKeys = Object.keys(value).some(k => /^\d+$/.test(k));
          if (hasNumericKeys) {
            colorPalettes[key] = value;
          }
        }
      }
    }

    return {
      ...baseTheme,
      defaultColorScheme: baseTheme.defaultColorScheme || autoScheme,
      colors: {
        primary: primaryHex,
        secondary: secondaryHex,
        accent: toHex(baseTheme.colors?.accent, secondaryHex),
        ...autoColors,
        ...normalizedUserColors // Override with normalized user colors (not raw palettes)
      },
      // Store palettes for generating utility classes
      _colorPalettes: colorPalettes
    };
  };

  // Always generate adaptive theme (even if pageTheme is empty)
  const adaptiveTheme = generateAdaptiveTheme(pageTheme);

  // Merge with defaults - ensure we always have complete theme
  const mergedTheme = deepMerge(defaultTheme, adaptiveTheme);

  // Helper to convert hex color to RGB triplet string "R G B"
  const hexToRgbTriplet = (hex) => {
    if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return null;
    const clean = hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;
    const r = parseInt(clean.slice(1, 3), 16);
    const g = parseInt(clean.slice(3, 5), 16);
    const b = parseInt(clean.slice(5, 7), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return `${r} ${g} ${b}`;
  };

  const generateCssVariables = (obj, prefix = '') => {
    return Object.entries(obj)
      .map(([key, value]) => {
        if (isObject(value) && !key.includes('hover') && !key.includes('focus') && !key.includes('active')) {
          return generateCssVariables(value, `${prefix}${key}-`);
        }
        // For color variables, also generate an RGB triplet variant for opacity composability
        const lines = [`--${prefix}${key}: ${value};`];
        if (prefix.startsWith('color-') && typeof value === 'string' && value.startsWith('#')) {
          const rgb = hexToRgbTriplet(value);
          if (rgb) {
            lines.push(`--${prefix}${key}-rgb: ${rgb};`);
          }
        }
        return lines.join('\n    ');
      })
      .filter(Boolean)
      .join('\n    ');
  };

  // Generate Element Styles
  const generateElementStyles = (elements) => {
    return Object.entries(elements)
      .map(([element, styles]) => {
        let baseStyles = Object.entries(styles)
          .filter(([key]) => key !== 'hover')
          .map(([key, value]) => `  ${key}: ${value};`)
          .join('\n');
        
        let hoverStyles = styles.hover ? 
          `${element}:hover {
            ${Object.entries(styles.hover)
              .map(([key, value]) => `  ${key}: ${value};`)
              .join('\n')}
          }` : '';

        return `${element} {
          ${baseStyles}
        }
        ${hoverStyles}`;
      })
      .join('\n\n');
  };

  // Helper function to extract hex color from various formats
  // Supports: "#hex", { 500: "#hex", ... } (Tailwind palette), or any object with numbered shades
  const extractHexColor = (color, fallback = '#6366f1') => {
    if (!color) return fallback;

    // Already a hex string
    if (typeof color === 'string' && color.startsWith('#')) {
      return color;
    }

    // Tailwind-style palette object - prefer 500, then 600, then first available shade
    if (typeof color === 'object' && color !== null) {
      // Priority: 500 (main), 600 (slightly darker), DEFAULT, then any numbered shade
      if (color['500']) return color['500'];
      if (color['600']) return color['600'];
      if (color['DEFAULT']) return color['DEFAULT'];
      if (color['default']) return color['default'];

      // Find first numbered shade (50, 100, 200, etc.)
      const shades = Object.keys(color).filter(k => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b));
      if (shades.length > 0) {
        // Pick middle shade if available
        const middleIndex = Math.floor(shades.length / 2);
        return color[shades[middleIndex]];
      }

      // Last resort: first value that looks like a hex
      const firstHex = Object.values(color).find(v => typeof v === 'string' && v.startsWith('#'));
      if (firstHex) return firstHex;
    }

    return fallback;
  };

  // Helper function to convert hex to HSL for shadcn/ui
  const hexToHsl = (hex) => {
    // Ensure we have a valid hex string
    const validHex = extractHexColor(hex, '#6366f1');
    const r = parseInt(validHex.slice(1, 3), 16) / 255;
    const g = parseInt(validHex.slice(3, 5), 16) / 255;
    const b = parseInt(validHex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  };

  // Convert theme colors to shadcn/ui format
  const generateShadcnVariables = (colors, isDark = false) => {
    const primary = hexToHsl(colors.primary || '#6366f1');
    const secondary = hexToHsl(colors.secondary || '#8b5cf6');
    const background = hexToHsl(colors.background || (isDark ? '#0f172a' : '#ffffff'));
    const surface = hexToHsl(colors.surface || (isDark ? '#1e293b' : '#f8fafc'));
    const text = hexToHsl(colors.text || (isDark ? '#f8fafc' : '#1e293b'));
    const border = hexToHsl(colors.border || (isDark ? '#334155' : '#e2e8f0'));
    const error = hexToHsl(colors.error || '#ef4444');

    return `
    --background: ${background.h} ${background.s}% ${background.l}%;
    --foreground: ${text.h} ${text.s}% ${text.l}%;
    --card: ${surface.h} ${surface.s}% ${surface.l}%;
    --card-foreground: ${text.h} ${text.s}% ${text.l}%;
    --popover: ${surface.h} ${surface.s}% ${surface.l}%;
    --popover-foreground: ${text.h} ${text.s}% ${text.l}%;
    --primary: ${primary.h} ${primary.s}% ${primary.l}%;
    --primary-foreground: ${isDark ? '222.2 84% 4.9%' : '210 40% 98%'};
    --secondary: ${isDark ? '217.2 32.6% 17.5%' : '210 40% 96%'};
    --secondary-foreground: ${text.h} ${text.s}% ${text.l}%;
    --muted: ${isDark ? '217.2 32.6% 17.5%' : '210 40% 96%'};
    --muted-foreground: ${isDark ? '215 20.2% 65.1%' : '215.4 16.3% 46.9%'};
    --accent: ${secondary.h} ${secondary.s}% ${secondary.l}%;
    --accent-foreground: ${text.h} ${text.s}% ${text.l}%;
    --destructive: ${error.h} ${error.s}% ${error.l}%;
    --destructive-foreground: ${isDark ? '210 40% 98%' : '210 40% 98%'};
    --border: ${border.h} ${border.s}% ${border.l}%;
    --input: ${border.h} ${border.s}% ${border.l}%;
    --ring: ${primary.h} ${primary.s}% ${primary.l}%;
    --chart-1: 12 76% 61%;
    --chart-2: 173 58% 39%;
    --chart-3: 197 37% 24%;
    --chart-4: 43 74% 66%;
    --chart-5: 27 87% 67%;
    --radius: ${mergedTheme.borders.radius.base};`;
  };

  // Generate comprehensive theme styles
  const currentScheme = mergedTheme.defaultColorScheme;
  // Use mergedTheme.colors (which has user overrides), not darkMode (which has defaults)
  const colorScheme = mergedTheme;

  // Dark mode colors should inherit tenant's main colors (e.g., primary, secondary)
  // so that a tenant setting primary: "#E3602D" doesn't get overridden by default dark mode purple.
  // Tenant-specific colors from pageTheme.colors take precedence, then darkMode defaults fill gaps.
  const effectiveDarkColors = {
    ...mergedTheme.darkMode.colors,
    ...(pageTheme.colors || {}),
    ...(pageTheme.darkMode?.colors || {}),
  };

  const themeStyles = `
  :root {
    /* Force color scheme - prevents browser dark mode from overriding site theme */
    color-scheme: ${currentScheme === 'dark' ? 'dark' : 'light'};

    /* JasonJS Theme Variables */
    ${generateCssVariables(colorScheme.colors, 'color-')}

    /* Typography Variables */
    --font-family: ${mergedTheme.typography.fontFamily};
    --font-heading: ${mergedTheme.typography.headings.fontFamily};
    --font-weight-heading: ${mergedTheme.typography.headings.fontWeight};
    --line-height-heading: ${mergedTheme.typography.headings.lineHeight};
    --font-size-body: ${mergedTheme.typography.body.fontSize};
    --line-height-body: ${mergedTheme.typography.body.lineHeight};
    --font-weight-body: ${mergedTheme.typography.body.fontWeight};

    /* Background Variables */
    ${mergedTheme.backgrounds ? generateCssVariables(mergedTheme.backgrounds, 'background-') : ''}

    /* Spacing Variables */
    ${generateCssVariables(mergedTheme.spacing, 'spacing-')}

    /* Border Variables */
    ${generateCssVariables(mergedTheme.borders.radius, 'radius-')}
    ${generateCssVariables(mergedTheme.borders.width, 'border-')}

    /* Shadow Variables */
    ${generateCssVariables(mergedTheme.shadows, 'shadow-')}
  }

  /* Override globals.css .dark class with tenant theme */
  /* Use :root.dark for higher specificity than globals.css .dark (inside @layer base) */
  ${currentScheme === 'dark' ? `:root.dark {
    /* shadcn/ui Variables - overrides globals.css */
    ${generateShadcnVariables(colorScheme.colors, true)}
  }` : ''}

  /* Light mode - use :root */
  ${currentScheme === 'light' ? `
  :root {
    /* shadcn/ui Variables */
    ${generateShadcnVariables(colorScheme.colors, false)}
  }` : ''}

  /* Dark mode theme variables */
  .theme-dark {
    ${generateCssVariables(effectiveDarkColors, 'color-')}

    /* shadcn/ui Dark Mode Variables */
    ${generateShadcnVariables(effectiveDarkColors, true)}
  }

  /* Base Typography */
  body {
    font-family: var(--font-family);
    font-size: var(--font-size-body);
    line-height: var(--line-height-body);
    font-weight: var(--font-weight-body);
    background-color: var(--color-background);
    color: var(--color-text);
    ${mergedTheme.typography?.body?.background ? `background: ${mergedTheme.typography.body.background};` : ''}
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-heading);
    font-weight: var(--font-weight-heading);
    line-height: var(--line-height-heading);
    color: inherit;
  }

  /* Theme utility classes - use higher specificity to override Tailwind's shadcn defaults */
  :root .bg-primary { background-color: rgb(var(--color-primary-rgb)); }
  :root .bg-secondary { background-color: rgb(var(--color-secondary-rgb)); }
  :root .bg-accent { background-color: rgb(var(--color-accent-rgb)); }
  :root .bg-surface { background-color: rgb(var(--color-surface-rgb)); }
  :root .bg-success { background-color: rgb(var(--color-success-rgb)); }
  :root .bg-warning { background-color: rgb(var(--color-warning-rgb)); }
  :root .bg-error { background-color: rgb(var(--color-error-rgb)); }
  :root .bg-info { background-color: rgb(var(--color-info-rgb)); }

  :root .text-primary { color: rgb(var(--color-primary-rgb)); }
  :root .text-secondary { color: rgb(var(--color-secondary-rgb)); }
  :root .text-accent { color: rgb(var(--color-accent-rgb)); }
  :root .text-muted { color: rgb(var(--color-textMuted-rgb)); }
  :root .text-success { color: rgb(var(--color-success-rgb)); }
  :root .text-warning { color: rgb(var(--color-warning-rgb)); }
  :root .text-error { color: rgb(var(--color-error-rgb)); }
  :root .text-info { color: rgb(var(--color-info-rgb)); }

  :root .border-primary { border-color: rgb(var(--color-primary-rgb)); }
  :root .border-secondary { border-color: rgb(var(--color-secondary-rgb)); }
  :root .border-accent { border-color: rgb(var(--color-accent-rgb)); }
  :root .border-base { border-color: rgb(var(--color-border-rgb)); }
  :root .border-light { border-color: rgb(var(--color-borderLight-rgb)); }

  :root .hover\\:text-primary:hover { color: rgb(var(--color-primary-rgb)); }
  :root .hover\\:text-secondary:hover { color: rgb(var(--color-secondary-rgb)); }
  :root .hover\\:text-accent:hover { color: rgb(var(--color-accent-rgb)); }

  :root .hover\\:bg-primary:hover { background-color: rgb(var(--color-primary-rgb)); }
  :root .hover\\:bg-secondary:hover { background-color: rgb(var(--color-secondary-rgb)); }
  :root .hover\\:bg-accent:hover { background-color: rgb(var(--color-accent-rgb)); }
  :root .hover\\:bg-hover:hover { background-color: rgb(var(--color-hover-rgb)); }

  :root .focus\\:border-primary:focus { border-color: rgb(var(--color-primary-rgb)); }
  :root .focus\\:border-secondary:focus { border-color: rgb(var(--color-secondary-rgb)); }
  :root .focus\\:ring-primary:focus { box-shadow: 0 0 0 3px rgb(var(--color-primary-rgb) / 0.1); }

  /* Font utilities */
  .font-body { font-family: var(--font-family); }
  .font-heading { font-family: var(--font-heading); }

  /* Radius utilities */
  .rounded-theme { border-radius: var(--radius-base); }
  .rounded-theme-sm { border-radius: var(--radius-sm); }
  .rounded-theme-lg { border-radius: var(--radius-lg); }

  /* Shadow utilities */
  .shadow-theme { box-shadow: var(--shadow-base); }
  .shadow-theme-sm { box-shadow: var(--shadow-sm); }
  .shadow-theme-lg { box-shadow: var(--shadow-lg); }

  /* Background utilities */
  ${mergedTheme.backgrounds ? Object.keys(mergedTheme.backgrounds)
    .map(key => `.bg-${key} { background: var(--background-${key}); }`)
    .join('\n  ') : ''}

  /* Palette shade utilities (generated from Tailwind-style color palettes) */
  ${generatePaletteShadeClasses(mergedTheme._colorPalettes || {})}
`;

  return {
    mergedTheme,
    themeStyles,
  };
}

/**
 * Generate Tailwind-style utility classes for color palettes
 * Creates classes like: bg-primary-50, text-primary-600, border-secondary-200, etc.
 * @param {Object} palettes - Object with color palettes (e.g., { primary: { 50: '#...', 500: '#...' } })
 * @returns {string} CSS utility classes
 */
function generatePaletteShadeClasses(palettes) {
  if (!palettes || Object.keys(palettes).length === 0) {
    return '';
  }

  const classes = [];

  for (const [colorName, shades] of Object.entries(palettes)) {
    if (typeof shades !== 'object' || shades === null) continue;

    for (const [shade, hex] of Object.entries(shades)) {
      // Only process numeric shades (50, 100, 200, etc.)
      if (!/^\d+$/.test(shade)) continue;
      if (typeof hex !== 'string' || !hex.startsWith('#')) continue;

      // Background classes
      classes.push(`.bg-${colorName}-${shade} { background-color: ${hex}; }`);

      // Text classes
      classes.push(`.text-${colorName}-${shade} { color: ${hex}; }`);

      // Border classes
      classes.push(`.border-${colorName}-${shade} { border-color: ${hex}; }`);

      // Gradient classes (from/via/to)
      classes.push(`.from-${colorName}-${shade} { --tw-gradient-from: ${hex} var(--tw-gradient-from-position); --tw-gradient-to: ${hex}00 var(--tw-gradient-to-position); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to); }`);
      classes.push(`.via-${colorName}-${shade} { --tw-gradient-to: ${hex}00 var(--tw-gradient-to-position); --tw-gradient-stops: var(--tw-gradient-from), ${hex} var(--tw-gradient-via-position), var(--tw-gradient-to); }`);
      classes.push(`.to-${colorName}-${shade} { --tw-gradient-to: ${hex} var(--tw-gradient-to-position); }`);

      // Ring classes
      classes.push(`.ring-${colorName}-${shade} { --tw-ring-color: ${hex}; }`);

      // Hover variants
      classes.push(`.hover\\:bg-${colorName}-${shade}:hover { background-color: ${hex}; }`);
      classes.push(`.hover\\:text-${colorName}-${shade}:hover { color: ${hex}; }`);
      classes.push(`.hover\\:border-${colorName}-${shade}:hover { border-color: ${hex}; }`);

      // Focus variants
      classes.push(`.focus\\:ring-${colorName}-${shade}:focus { --tw-ring-color: ${hex}; }`);
      classes.push(`.focus\\:border-${colorName}-${shade}:focus { border-color: ${hex}; }`);
    }
  }

  return classes.join('\n  ');
}