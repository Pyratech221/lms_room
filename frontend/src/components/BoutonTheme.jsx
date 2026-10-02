import { useTheme } from '../useTheme';

function BoutonTheme() {
  const { theme, basculerTheme } = useTheme();

  return (
    <button onClick={basculerTheme} title="Changer de thème">
      {theme === 'clair' ? '🌙 Sombre' : '☀️ Clair'}
    </button>
  );
}

export default BoutonTheme;