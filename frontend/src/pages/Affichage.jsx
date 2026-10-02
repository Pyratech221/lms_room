import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import '../styles/Affichage.css';

/** Heure locale au format 08:30 à partir d'un ISO 8601 renvoyé par l'API. */
function heure(iso) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

const INTERVALLE_RAFRAICHISSEMENT = 5 * 60 * 1000;

/**
 * Écran mural, sans authentification : un écran accroché dans un couloir ne peut pas
 * saisir de mot de passe. L'API ne renvoie donc que l'ONG et l'horaire des créneaux
 * validés — ni nom, ni e-mail, ni objet de réunion.
 */
function Affichage() {
  const [donnees, setDonnees] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [maintenant, setMaintenant] = useState(() => new Date());

  const charger = useCallback(async () => {
    try {
      const reponse = await api.get('/affichage/');
      setDonnees(reponse.data);
      setErreur(false);
    } catch {
      // On garde le dernier affichage connu : un écran vide est moins utile
      // qu'un écran légèrement daté.
      setErreur(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    charger();
    const rafraichissement = setInterval(charger, INTERVALLE_RAFRAICHISSEMENT);
    const horloge = setInterval(() => setMaintenant(new Date()), 30 * 1000);
    return () => {
      clearInterval(rafraichissement);
      clearInterval(horloge);
    };
  }, [charger]);

  const dateLisible = maintenant.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="affichage">
      <header className="affichage-entete">
        <div>
          <h1>La Maison de la Conservation</h1>
          <p className="affichage-date">{dateLisible}</p>
        </div>
        <div className="affichage-horloge">
          {maintenant.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </header>

      {donnees === null ? (
        <p className="affichage-message">Chargement de l'occupation du jour…</p>
      ) : (
        <div className="affichage-grille">
          {donnees.salles.map((salle) => {
            const enCours = salle.creneaux.find(
              (c) => new Date(c.debut) <= maintenant && maintenant < new Date(c.fin)
            );
            return (
              <section
                key={salle.nom}
                className={`affichage-salle ${enCours ? 'occupee' : 'libre'}`}
              >
                <div className="affichage-salle-entete">
                  <h2>{salle.nom}</h2>
                  <span className="affichage-etat">{enCours ? 'Occupée' : 'Libre'}</span>
                </div>
                <p className="affichage-capacite">{salle.capacite} places</p>

                {salle.creneaux.length === 0 ? (
                  <p className="affichage-vide">Libre toute la journée</p>
                ) : (
                  <ul className="affichage-creneaux">
                    {salle.creneaux.map((creneau) => (
                      <li
                        key={creneau.debut}
                        className={creneau === enCours ? 'creneau-actuel' : ''}
                      >
                        <span className="creneau-heures">
                          {heure(creneau.debut)} – {heure(creneau.fin)}
                        </span>
                        <span className="creneau-ong">{creneau.ong ?? 'Réservée'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      <footer className="affichage-pied">
        {erreur
          ? 'Connexion interrompue — dernières informations connues.'
          : 'Actualisation automatique toutes les 5 minutes.'}
      </footer>
    </div>
  );
}

export default Affichage;
