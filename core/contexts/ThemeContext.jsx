'use client';
import { createContext, useContext } from 'react';

const ThemeContext = createContext({
  theme: null,
  isDark: false
});

export function ThemeProvider({ children, theme }) {
  // Respect explicit theme setting, default to light if not specified
  const isDark = theme?.defaultColorScheme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export default ThemeContext;