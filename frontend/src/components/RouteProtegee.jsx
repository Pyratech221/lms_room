import { Navigate } from 'react-router-dom';
import { useAuth } from '../useAuth';
import DemanderNom from './DemanderNom';

/** Réserve une page aux utilisateurs connectés, sinon renvoie vers la page de connexion. */
function RouteProtegee({ children }) {
  const { utilisateur, chargement } = useAuth();

  // Tant que la session n'est pas vérifiée, on n'affiche ni la page ni la redirection :
  // sans ça, un utilisateur déjà connecté serait renvoyé vers /login au premier rendu.
  if (chargement) {
    return (
      <div className="page-centree">
        <div className="spinner"></div>
        <p>Chargement…</p>
      </div>
    );
  }

  if (!utilisateur) {
    return <Navigate to="/login" replace />;
  }

  // Le lien de connexion n'apporte qu'une adresse e-mail. On demande le nom une
  // seule fois, avant d'ouvrir l'application, pour que les réservations soient
  // attribuables à une personne et non à une boîte mail.
  if (!utilisateur.nom) {
    return (
      <>
        {children}
        <DemanderNom />
      </>
    );
  }

  return children;
}

export default RouteProtegee;
