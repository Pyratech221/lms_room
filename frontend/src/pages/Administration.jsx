import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../useAuth';
import api from '../api';
import Sidebar from '../components/Sidebar';
import BarChart from '../components/BarChart';
import { IconCalendar, IconCheckCircle, IconClock, IconXCircle } from '../components/icons';
import '../styles/Dashboard.css';

const ONGS = ['WIACO', 'RAMPAO', 'PRCM', 'BirdLife'];

function Administration() {
  const { utilisateur, chargement: authChargement } = useAuth();
  const navigate = useNavigate();
  const [reservations, setReservations] = useState([]);
  const [salles, setSalles] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    if (authChargement) return;
    if (utilisateur?.role !== 'ADMIN') {
      navigate('/accueil', { replace: true });
    }
  }, [authChargement, utilisateur, navigate]);

  useEffect(() => {
    if (authChargement || utilisateur?.role !== 'ADMIN') return;

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
  }, [authChargement, utilisateur]);

  const statistiques = useMemo(() => {
    const total = reservations.length;
    const valide = reservations.filter((r) => r.statut === 'VALIDE').length;
    const enAttente = reservations.filter((r) => r.statut === 'EN_ATTENTE').length;
    const annule = reservations.filter((r) => r.statut === 'ANNULE').length;
    return { total, valide, enAttente, annule };
  }, [reservations]);

  const reservationsParOng = useMemo(
    () =>
      ONGS.map((nom) => ({
        label: nom,
        value: reservations.filter((r) => r.utilisateur_ong === nom).length,
      })),
    [reservations]
  );

  const reservationsParSalle = useMemo(
    () =>
      salles.map((salle) => ({
        label: salle.nom,
        value: reservations.filter((r) => r.salle === salle.id).length,
      })),
    [salles, reservations]
  );

  if (authChargement || chargement || utilisateur?.role !== 'ADMIN') {
    return (
      <div className="page-centree">
        <div className="spinner"></div>
        <p>Chargement des données…</p>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <Sidebar actif="administration" utilisateur={utilisateur} />

      <main className="dashboard-main">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Tableau de bord</h1>
            <p className="dashboard-subtitle">Supervision et statistiques d'occupation</p>
          </div>
        </div>

        <div className="card-row">
          <article className="stat-card">
            <p className="stat-title">
              <span className="stat-icon"><IconCalendar size={16} /></span> Total réservations
            </p>
            <p className="stat-value">{statistiques.total}</p>
          </article>
          <article className="stat-card success">
            <p className="stat-title">
              <span className="stat-icon"><IconCheckCircle size={16} /></span> Validées
            </p>
            <p className="stat-value">{statistiques.valide}</p>
          </article>
          <article className="stat-card warning">
            <p className="stat-title">
              <span className="stat-icon"><IconClock size={16} /></span> En attente
            </p>
            <p className="stat-value">{statistiques.enAttente}</p>
          </article>
          <article className="stat-card danger">
            <p className="stat-title">
              <span className="stat-icon"><IconXCircle size={16} /></span> Annulées
            </p>
            <p className="stat-value">{statistiques.annule}</p>
          </article>
        </div>

        <div className="chart-grid">
          <article className="chart-card">
            <h2 className="chart-title">Réservations par ONG</h2>
            <BarChart data={reservationsParOng} />
          </article>
          <article className="chart-card">
            <h2 className="chart-title">Réservations par salle</h2>
            <BarChart data={reservationsParSalle} />
          </article>
        </div>
      </main>
    </div>
  );
}

export default Administration;
