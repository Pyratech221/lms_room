import { useState } from 'react';
import api from '../api';
import { useAuth } from '../useAuth';

/**
 * Demande son nom à l'utilisateur tant qu'il n'en a pas enregistré un.
 * Le lien de connexion ne fournit que l'adresse e-mail : sans ce nom, une
 * réservation n'est identifiable que par un e-mail, illisible sur un écran partagé.
 */
function DemanderNom() {
  const { utilisateur, rafraichirUtilisateur } = useAuth();
  const [nom, setNom] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const enregistrer = async (evenement) => {
    evenement.preventDefault();
    const valeur = nom.trim();

    if (valeur.length < 2) {
      setErreur('Merci d’indiquer votre nom complet.');
      return;
    }

    setErreur('');
    setEnvoiEnCours(true);
    try {
      await api.post('/auth/profil/', { nom: valeur });
      // Le rafraîchissement démonte ce composant : pas de remise à zéro de l'envoi.
      await rafraichirUtilisateur();
    } catch {
      setErreur('Enregistrement impossible, réessayez.');
      setEnvoiEnCours(false);
    }
  };

  return (
    <div className="modal-overlay">
      <form className="modal-card" onSubmit={enregistrer}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Bienvenue</h2>
            <p>Comment devons-nous vous appeler ?</p>
          </div>
        </div>

        <div className="modal-grid">
          <p className="modal-aide">
            Votre nom apparaîtra à côté de vos réservations, pour que chacun sache qui
            occupe une salle. Connecté avec <strong>{utilisateur?.email}</strong>.
          </p>

          <label>
            Nom complet
            <input
              type="text"
              value={nom}
              onChange={(evenement) => setNom(evenement.target.value)}
              placeholder="Prénom Nom"
              maxLength={120}
              autoFocus
              required
            />
          </label>

          {erreur && <p className="modal-error">{erreur}</p>}
        </div>

        <div className="modal-actions">
          <button type="submit" className="modal-primary" disabled={envoiEnCours}>
            {envoiEnCours ? 'Enregistrement…' : 'Continuer'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default DemanderNom;
