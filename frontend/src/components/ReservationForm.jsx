import { useState } from 'react';
import api from '../api';
import { useAuth } from '../useAuth';

/** Format AAAA-MM-JJ dans le fuseau local (toISOString décalerait d'un jour selon le fuseau). */
function formatDateISO(date) {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const jourDuMois = String(date.getDate()).padStart(2, '0');
  return `${annee}-${mois}-${jourDuMois}`;
}

function ReservationForm({ salles, jour, onFermer, onCree }) {
  const { utilisateur } = useAuth();
  // Un administrateur n'a pas d'ONG : il ne réserve jamais pour lui-même, toujours
  // au nom de la personne qui lui a transmis la demande.
  const reservePourAutrui = utilisateur?.role === 'ADMIN';

  const [salleSelectionnee, setSalleSelectionnee] = useState(null);
  const [pourNom, setPourNom] = useState('');
  const [pourEmail, setPourEmail] = useState('');
  const [dateISO, setDateISO] = useState(() => formatDateISO(jour ?? new Date()));
  const [heureDebut, setHeureDebut] = useState('09:00');
  const [heureFin, setHeureFin] = useState('10:00');
  const [objet, setObjet] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const salleValue = salleSelectionnee ?? salles?.[0]?.id ?? '';

  // Libellé du jour, recalculé quand la date change dans le formulaire.
  const libelleJour = dateISO
    ? new Date(`${dateISO}T00:00:00`).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur('');

    if (!dateISO) {
      setErreur('Veuillez choisir une date.');
      return;
    }

    if (heureFin <= heureDebut) {
      setErreur("L'heure de fin doit être après l'heure de début.");
      return;
    }

    if (!salleValue) {
      setErreur('Veuillez choisir une salle.');
      return;
    }

    if (reservePourAutrui && (!pourNom.trim() || !pourEmail.includes('@'))) {
      setErreur("Indiquez le nom et l'e-mail de la personne pour qui vous réservez.");
      return;
    }

    setEnvoiEnCours(true);
    try {
      const response = await api.post('/reservations/creer/', {
        salle: salleValue,
        date_heure_debut: `${dateISO}T${heureDebut}:00Z`,
        date_heure_fin: `${dateISO}T${heureFin}:00Z`,
        objet,
        ...(reservePourAutrui && { pour_nom: pourNom.trim(), pour_email: pourEmail.trim() }),
      });

      const statut = response.data.statut;
      // On transmet la date retenue pour que la page puisse afficher le jour concerné.
      onCree(statut, dateISO);
    } catch (err) {
      if (err.response?.status === 409) {
        setErreur('Ce créneau est déjà réservé sur cette salle.');
      } else if (err.response?.status === 401) {
        setErreur('Votre session a expiré, reconnectez-vous.');
      } else if (err.response?.status === 400 && err.response.data?.detail) {
        // Le backend explique déjà précisément ce qui manque : on le relaie tel quel.
        setErreur(err.response.data.detail);
      } else {
        setErreur('Une erreur est survenue, réessayez.');
      }
    } finally {
      setEnvoiEnCours(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Nouvelle réservation</h2>
            <p>{libelleJour}</p>
          </div>
          <button type="button" className="modal-close" onClick={onFermer}>
            ×
          </button>
        </div>

        <div className="modal-grid">
          {reservePourAutrui && (
            <>
              <p className="modal-aide">
                Vous réservez au nom d'une autre personne : elle retrouvera cette
                réservation en se connectant avec son e-mail.
              </p>
              <div className="modal-row">
                <label>
                  Pour (nom)
                  <input
                    type="text"
                    value={pourNom}
                    onChange={(e) => setPourNom(e.target.value)}
                    placeholder="Prénom Nom"
                    maxLength={120}
                    required
                  />
                </label>
                <label>
                  Pour (e-mail)
                  <input
                    type="email"
                    value={pourEmail}
                    onChange={(e) => setPourEmail(e.target.value)}
                    placeholder="prenom.nom@ong.org"
                    required
                  />
                </label>
              </div>
            </>
          )}

          <label>
            Salle
            <select value={salleValue} onChange={(e) => setSalleSelectionnee(Number(e.target.value))} required>
              {salles.map((salle) => (
                <option key={salle.id} value={salle.id}>
                  {salle.nom} — {salle.capacite} places
                </option>
              ))}
            </select>
          </label>

          <div className="modal-row">
            <label>
              Date
              <input
                type="date"
                value={dateISO}
                onChange={(e) => setDateISO(e.target.value)}
                required
              />
            </label>

            <label>
              Objet
              <input
                type="text"
                value={objet}
                onChange={(e) => setObjet(e.target.value)}
                placeholder="Motif de la réunion"
                maxLength={80}
              />
            </label>
          </div>

          <div className="modal-row">
            <label>
              Début
              <input type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} required />
            </label>

            <label>
              Fin
              <input type="time" value={heureFin} onChange={(e) => setHeureFin(e.target.value)} required />
            </label>
          </div>

          {erreur && <p className="modal-error">{erreur}</p>}
        </div>

        <div className="modal-actions">
          <button type="button" className="modal-secondary" onClick={onFermer}>
            Annuler
          </button>
          <button type="button" className="modal-primary" onClick={handleSubmit} disabled={envoiEnCours}>
            {envoiEnCours ? 'Envoi...' : 'Réserver'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReservationForm;
