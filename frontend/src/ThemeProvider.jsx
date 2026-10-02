import { useState, useEffect } from 'react';
import { ThemeContext } from './contexts/ThemeContext';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'clair';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'sombre' ? 'sombre' : 'clair');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const basculerTheme = () => {
    setTheme((t) => (t === 'clair' ? 'sombre' : 'clair'));
  };

  return (
    <ThemeContext.Provider value={{ theme, basculerTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
