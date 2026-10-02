import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../useAuth';
import { debutDeSemaine, joursDeLaSemaine, formatDateAffichage, estMemeJour } from '../utils/dates';
import { peutTraiter } from '../utils/priorite';
import ReservationForm from '../components/ReservationForm';
import Sidebar from '../components/Sidebar';
import {
  IconChevronLeft,
  IconChevronRight,
  IconCheck,
  IconX,
  IconMonitor,
  IconVideo,
  IconClipboard,
  IconVolume,
  IconWifi,
  IconSnowflake,
  IconTag,
} from '../components/icons';
import '../styles/Dashboard.css';
import '../styles/Calendrier.css';

const ICONES_EQUIPEMENT = {
  'Écran de projection': IconMonitor,
  "Caméra d'appel": IconVideo,
  'Tableau à rouleau papier': IconClipboard,
  'Baffle audio': IconVolume,
  'WiFi haute vitesse': IconWifi,
  Climatisation: IconSnowflake,
};

function IconEquipement({ nom, size = 14 }) {
  const IconComponent = ICONES_EQUIPEMENT[nom] ?? IconTag;
  return <IconComponent size={size} />;
}

function Calendrier() {
  const { utilisateur } = useAuth();

  const [semaineActuelle, setSemaineActuelle] = useState(() => debutDeSemaine(new Date()));
  const [reservations, setReservations] = useState([]);
  const [salles, setSalles] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [creneauSelectionne, setCreneauSelectionne] = useState(null);
  const [messageConfirmation, setMessageConfirmation] = useState('');

  const chargerDonnees = useCallback(async () => {
    setChargement(true);
    try {
      const [reservationsRes, sallesRes] = await Promise.all([
        api.get('/reservations/'),
        api.get('/salles/'),
      ]);
      setReservations(reservationsRes.data);
      setSalles(sallesRes.data);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    chargerDonnees();
  }, [chargerDonnees]);

  const jours = joursDeLaSemaine(semaineActuelle);

  const reservationsPour = (salleId, jour) => {
    return reservations.filter((r) => {
      const dateReservation = new Date(r.date_heure_debut);
      return r.salle === salleId && estMemeJour(dateReservation, jour);
    });
  };

  const semainePrecedente = () => {
    const nouvelleDate = new Date(semaineActuelle);
    nouvelleDate.setDate(nouvelleDate.getDate() - 7);
    setSemaineActuelle(nouvelleDate);
  };

  const semaineSuivante = () => {
    const nouvelleDate = new Date(semaineActuelle);
    nouvelleDate.setDate(nouvelleDate.getDate() + 7);
    setSemaineActuelle(nouvelleDate);
  };

  const handleReservationCreee = (statut) => {
    chargerDonnees();
    setMessageConfirmation(
      statut === 'VALIDE'
        ? 'Réservation validée !'
        : 'Demande enregistrée, en attente de validation.'
    );
    setTimeout(() => setMessageConfirmation(''), 4000);
  };

  const traiterReservation = async (reservationId, action) => {
    try {
      await api.post(`/reservations/${reservationId}/traiter/`, { action });
      chargerDonnees();
    } catch {
      alert("Action refusée ou une erreur est survenue.");
    }
  };

  if (chargement) {
    return (
      <div className="page-centree">
        <div className="spinner"></div>
        <p>Chargement des données…</p>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <Sidebar actif="calendrier" utilisateur={utilisateur} />

      <main className="dashboard-main">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Mes réservations</h1>
            <p className="dashboard-subtitle">
              {formatDateAffichage(jours[0])} — {formatDateAffichage(jours[jours.length - 1])}
            </p>
          </div>

          <div className="dashboard-toolbar">
            <div className="date-controls">
              <button type="button" className="date-button" onClick={semainePrecedente} aria-label="Semaine précédente">
                <IconChevronLeft size={16} />
              </button>
              <span className="date-text">Semaine</span>
              <button type="button" className="date-button" onClick={semaineSuivante} aria-label="Semaine suivante">
                <IconChevronRight size={16} />
              </button>
            </div>
            <button
              type="button"
              className="primary-action"
              onClick={() => setCreneauSelectionne({ jour: new Date() })}
            >
              Nouvelle réservation
            </button>
          </div>
        </div>

        {messageConfirmation && (
          <div className="info-banner succes">
            <strong>{messageConfirmation}</strong>
            <span>Les dernières informations ont bien été prises en compte.</span>
          </div>
        )}

        <div className="salles-grid">
          {salles.map((salle) => (
            <div key={salle.id} className="salle-card">
              <div className="salle-header">
                <h2>{salle.nom}</h2>
                <span className="badge">{salle.capacite} places</span>
              </div>

              {salle.equipements && salle.equipements.length > 0 && (
                <div className="equipements">
                  {salle.equipements.map((eq) => (
                    <span key={eq.id} className="equipment-badge" title={eq.nom}>
                      <IconEquipement nom={eq.nom} /> {eq.nom}
                    </span>
                  ))}
                </div>
              )}

              <div className="reservations-list">
                <h3>Réservations cette semaine</h3>
                {jours.map((jour) => {
                  const resas = reservationsPour(salle.id, jour);
                  return (
                    <div key={jour.toISOString()} className="jour-section">
                      <div className="jour-titre">{formatDateAffichage(jour)}</div>
                      {resas.length > 0 ? (
                        <div className="reservations">
                          {resas.map((r) => (
                            <div key={r.id} className={`reservation-item statut-${r.statut.toLowerCase()}`}>
                              <div className="resa-time">
                                {new Date(r.date_heure_debut).toLocaleTimeString('fr-FR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}{' '}
                                -{' '}
                                {new Date(r.date_heure_fin).toLocaleTimeString('fr-FR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                              <div className="resa-info">
                                {/* Créneau masqué : occupé par la demande d'un autre,
                                    dont ni l'objet ni l'auteur ne sont exposés. */}
                                <strong>
                                  {r.masque ? 'En attente de validation' : r.objet || '(sans objet)'}
                                </strong>
                                {!r.masque && (
                                  <em>
                                    {r.utilisateur_nom && `${r.utilisateur_nom} · `}
                                    {r.utilisateur_email}
                                    {r.utilisateur_ong && ` (${r.utilisateur_ong})`}
                                  </em>
                                )}
                              </div>
                              {r.statut === 'EN_ATTENTE' && peutTraiter(utilisateur) && (
                                <div className="resa-actions">
                                  <button
                                    className="btn btn-sm btn-success"
                                    onClick={() => traiterReservation(r.id, 'valider')}
                                    aria-label="Valider"
                                  >
                                    <IconCheck size={15} />
                                  </button>
                                  <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => traiterReservation(r.id, 'rejeter')}
                                    aria-label="Rejeter"
                                  >
                                    <IconX size={15} />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="empty-slot">Disponible</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </main>

      {creneauSelectionne && (
        <ReservationForm
          salles={salles}
          jour={creneauSelectionne.jour}
          onFermer={() => setCreneauSelectionne(null)}
          onCree={handleReservationCreee}
        />
      )}
    </div>
  );
}

export default Calendrier;