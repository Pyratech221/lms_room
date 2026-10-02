import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../useAuth';
import api from '../api';
import ReservationForm from '../components/ReservationForm';
import Sidebar from '../components/Sidebar';
import { IconChevronLeft, IconChevronRight, IconCrown, IconUsers, IconCheck, IconX } from '../components/icons';
import { formatDateAffichage, estMemeJour } from '../utils/dates';
import { ongPrioritaireDuJour, peutTraiter } from '../utils/priorite';
import '../styles/Dashboard.css';

function Accueil() {
  const { utilisateur } = useAuth();
  const [salles, setSalles] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [modalOuvert, setModalOuvert] = useState(false);
  const [messageConfirmation, setMessageConfirmation] = useState('');

  useEffect(() => {
    const chargerDonnees = async () => {
      setChargement(true);
      try {
        const [reservationsRes, sallesRes] = await Promise.all([
          api.get('/reservations/'),
          api.get('/salles/'),
        ]);
        setReservations(reservationsRes.data);
        setSalles(sallesRes.data);
      } catch (err) {
        console.error('Erreur de chargement :', err);
      } finally {
        setChargement(false);
      }
    };

    chargerDonnees();
  }, []);

  const reservationsDuJour = useMemo(
    () => reservations.filter((r) => estMemeJour(new Date(r.date_heure_debut), selectedDate)),
    [reservations, selectedDate]
  );

  const statistiques = useMemo(() => {
    const total = reservationsDuJour.length;
    const valide = reservationsDuJour.filter((r) => r.statut === 'VALIDE').length;
    const enAttente = reservationsDuJour.filter((r) => r.statut === 'EN_ATTENTE').length;
    const annule = reservationsDuJour.filter((r) => r.statut === 'ANNULE').length;
    return { total, valide, enAttente, annule };
  }, [reservationsDuJour]);

  const reservationsPourSalle = (salleId) =>
    reservationsDuJour.filter((r) => r.salle === salleId);

  const decrementerJour = () => {
    const nouveau = new Date(selectedDate);
    nouveau.setDate(nouveau.getDate() - 1);
    setSelectedDate(nouveau);
  };

  const incrementerJour = () => {
    const nouveau = new Date(selectedDate);
    nouveau.setDate(nouveau.getDate() + 1);
    setSelectedDate(nouveau);
  };

  const allerAujourdhui = () => setSelectedDate(new Date());

  const handleDateChange = (e) => {
    if (!e.target.value) return;
    const [annee, mois, jour] = e.target.value.split('-').map(Number);
    setSelectedDate(new Date(annee, mois - 1, jour));
  };

  const dateInputValue = useMemo(() => {
    const annee = selectedDate.getFullYear();
    const mois = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const jour = String(selectedDate.getDate()).padStart(2, '0');
    return `${annee}-${mois}-${jour}`;
  }, [selectedDate]);

  const salleAvecPriorite = salles.find((s) => s.necessite_priorite);
  const ongPrioritaireJour = ongPrioritaireDuJour(selectedDate);

  const handleReservationCreee = async (statut, dateReservation) => {
    setModalOuvert(false);

    // Si la réservation a été posée sur un autre jour, on s'y déplace pour qu'elle soit visible.
    if (dateReservation) {
      const [annee, mois, jour] = dateReservation.split('-').map(Number);
      setSelectedDate(new Date(annee, mois - 1, jour));
    }

    setMessageConfirmation(
      statut === 'VALIDE'
        ? 'Réservation validée !'
        : 'Demande enregistrée, en attente de validation.'
    );
    setTimeout(() => setMessageConfirmation(''), 4000);

    try {
      const reservationsRes = await api.get('/reservations/');
      setReservations(reservationsRes.data);
    } catch (err) {
      console.error('Impossible de recharger les réservations :', err);
    }
  };

  const traiterReservation = async (reservationId, action) => {
    try {
      await api.post(`/reservations/${reservationId}/traiter/`, { action });
      const reservationsRes = await api.get('/reservations/');
      setReservations(reservationsRes.data);
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
      <Sidebar actif="accueil" utilisateur={utilisateur} />

      <main className="dashboard-main">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Disponibilité des salles</h1>
            <p className="dashboard-subtitle">
              {formatDateAffichage(selectedDate).replace(/^./, (c) => c.toUpperCase())}
            </p>
          </div>

          <div className="dashboard-toolbar">
            <div className="date-controls">
              <button type="button" className="date-button" onClick={decrementerJour} aria-label="Jour précédent">
                <IconChevronLeft size={16} />
              </button>
              <button type="button" className="date-button date-today" onClick={allerAujourdhui}>
                Aujourd'hui
              </button>
              <button type="button" className="date-button" onClick={incrementerJour} aria-label="Jour suivant">
                <IconChevronRight size={16} />
              </button>
              <input
                type="date"
                className="date-input"
                value={dateInputValue}
                onChange={handleDateChange}
              />
            </div>
            <button type="button" className="primary-action" onClick={() => setModalOuvert(true)}>
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

        {salleAvecPriorite && ongPrioritaireJour && (
          <div className="info-banner priority-banner">
            <span className="banner-icon"><IconCrown size={20} /></span>
            <p>
              <strong>
                {salleAvecPriorite.nom} — Priorité {ongPrioritaireJour}
              </strong>{' '}
              : l'ONG {ongPrioritaireJour} est prioritaire aujourd'hui. Toute réservation par une
              autre ONG est mise en attente et doit être validée par un administrateur.
            </p>
          </div>
        )}

        <div className="card-row">
          <article className="stat-card">
            <p className="stat-title">Total des réservations</p>
            <p className="stat-value">{statistiques.total}</p>
          </article>
          <article className="stat-card success">
            <p className="stat-title">Validées</p>
            <p className="stat-value">{statistiques.valide}</p>
          </article>
          <article className="stat-card warning">
            <p className="stat-title">En attente</p>
            <p className="stat-value">{statistiques.enAttente}</p>
          </article>
          <article className="stat-card danger">
            <p className="stat-title">Annulées</p>
            <p className="stat-value">{statistiques.annule}</p>
          </article>
        </div>

        {salles.map((salle) => {
          const salleReservations = reservationsPourSalle(salle.id);
          return (
            <article key={salle.id} className="room-card">
              <div className="room-card-header">
                <div>
                  <h2>{salle.nom}</h2>
                  <div className="room-meta">
                    <span><IconUsers size={15} /> {salle.capacite} places</span>
                    <span>{salle.description}</span>
                  </div>
                </div>
                <div className="room-status">{salleReservations.length} réservation(s)</div>
              </div>

              <div className="timeline">
                <div className="timeline-grid">
                  <span>07:00</span>
                  <span>09:00</span>
                  <span>11:00</span>
                  <span>13:00</span>
                  <span>15:00</span>
                  <span>17:00</span>
                  <span>19:00</span>
                </div>
                <div className="timeline-content">
                  {salleReservations.length === 0 ? (
                    <div className="timeline-empty">Libre toute la journée</div>
                  ) : (
                    <div className="timeline-reservation">
                      {salleReservations.map((reservation) => (
                        <div
                          key={reservation.id}
                          className={`reservation-pill ${
                            reservation.statut === 'EN_ATTENTE' ? 'en-attente' : ''
                          } ${reservation.statut === 'REJETE' ? 'rejete' : ''}`}
                        >
                          <div className="reservation-pill-header">
                            <strong>
                              {/* Demande déposée par quelqu'un d'autre : le créneau est
                                  occupé, mais son contenu ne nous regarde pas. */}
                              {reservation.masque
                                ? 'Créneau en attente de validation'
                                : reservation.objet || 'Sans objet'}
                            </strong>
                            {reservation.statut === 'EN_ATTENTE' && (
                              <span className="pill-badge">En attente</span>
                            )}
                            {reservation.statut === 'REJETE' && (
                              <span className="pill-badge rejete">Rejetée</span>
                            )}
                          </div>
                          <span>
                            {new Date(reservation.date_heure_debut).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            -{' '}
                            {new Date(reservation.date_heure_fin).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {!reservation.masque && (
                            <span>
                              {reservation.utilisateur_nom && `${reservation.utilisateur_nom} · `}
                              {reservation.utilisateur_email}
                              {reservation.utilisateur_ong && ` (${reservation.utilisateur_ong})`}
                            </span>
                          )}

                          {reservation.statut === 'EN_ATTENTE' && peutTraiter(utilisateur) && (
                            <div className="pill-actions">
                              <button
                                type="button"
                                className="pill-action valider"
                                onClick={() => traiterReservation(reservation.id, 'valider')}
                              >
                                <IconCheck size={14} /> Valider
                              </button>
                              <button
                                type="button"
                                className="pill-action rejeter"
                                onClick={() => traiterReservation(reservation.id, 'rejeter')}
                              >
                                <IconX size={14} /> Rejeter
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="room-footer">
                <span>{salle.equipements?.length ? `${salle.equipements.length} équipement(s)` : 'Aucun équipement listé'}</span>
              </div>
            </article>
          );
        })}
      </main>

      {modalOuvert && (
        <ReservationForm
          jour={selectedDate}
          salles={salles}
          onFermer={() => setModalOuvert(false)}
          onCree={handleReservationCreee}
        />
      )}
    </div>
  );
}

export default Accueil;
