import { useNavigate } from 'react-router-dom';
import { useAuth } from '../useAuth';
import { IconMaison, IconGrid, IconCalendar, IconBarChart, IconLogout } from './icons';

function Sidebar({ actif, utilisateur }) {
  const navigate = useNavigate();
  const { deconnecter } = useAuth();

  const handleDeconnexion = async () => {
    await deconnecter();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="dashboard-sidebar">
      <div>
        <div className="brand-meta">
          <div className="brand-icon">
            <IconMaison size={26} />
          </div>
          <div>
            <p className="brand-title">La Maison de la Conservation</p>
            <p className="brand-subtitle">WIACO&nbsp;· RAMPAO&nbsp;· PRCM&nbsp;· BirdLife</p>
          </div>
        </div>

        <nav className="nav-menu">
          <a href="/accueil" className={`nav-item ${actif === 'accueil' ? 'active' : ''}`}>
            <span><IconGrid size={17} /></span>
            Accueil
          </a>
          <a href="/calendrier" className={`nav-item ${actif === 'calendrier' ? 'active' : ''}`}>
            <span><IconCalendar size={17} /></span>
            Mes réservations
          </a>
          {utilisateur?.role === 'ADMIN' && (
            <a href="/administration" className={`nav-item ${actif === 'administration' ? 'active' : ''}`}>
              <span><IconBarChart size={17} /></span>
              Administration
            </a>
          )}
        </nav>
      </div>

      <div className="user-panel">
        <strong>{utilisateur?.nom || utilisateur?.email}</strong>
        {/* Un administrateur n'appartient à aucune ONG : le dire ainsi plutôt que
            d'afficher une absence. */}
        <span>
          {utilisateur?.role === 'ADMIN' ? 'Admin' : (utilisateur?.ong ?? 'Aucune ONG associée')}
        </span>
        <button
          type="button"
          className="nav-item"
          onClick={handleDeconnexion}
          style={{ justifyContent: 'flex-start', padding: '0.85rem 1rem', width: '100%' }}
        >
          <span><IconLogout size={17} /></span>
          Déconnexion
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
