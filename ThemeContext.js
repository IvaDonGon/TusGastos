// ThemeContext.js
import React, { createContext, useContext, useMemo, useState } from 'react';
import { Appearance } from 'react-native';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const system = Appearance.getColorScheme();
  const [isDark, setIsDark] = useState(system === 'dark');

  const toggleTheme = () => setIsDark(prev => !prev);

  const theme = useMemo(() => ({
    isDark,
    colors: {
      background: isDark ? '#000' : '#fff',
      text: isDark ? '#fff' : '#000',
      card: isDark ? '#151515' : '#f6f6f6',
      accent: '#007AFF', // Azul iOS moderno
      border: isDark ? '#2b2b2b' : '#e6e6e6',
    },
    fonts: {
      family: 'Montserrat-Regular', // Fuente base
      sizes: {
        title: 26,
        subtitle: 18,
        body: 16,
        small: 13,
      },
      weights: {
        regular: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
    },
  }), [isDark]);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
