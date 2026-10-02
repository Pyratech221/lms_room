import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { oublierJetonCsrf } from '../api';
import { useAuth } from '../useAuth';
import { IconMaison, IconMail } from '../components/icons';
import logoWetlands from '../assets/logos/wetlands.webp';
import logoRampao from '../assets/logos/rampao.webp';
import logoPrcm from '../assets/logos/prcm.webp';
import logoBirdlife from '../assets/logos/birdlife.webp';
import '../styles/Login.css';

// Même ordre que dans la barre latérale. Les hauteurs sont équilibrées à l'œil et non
// égalisées : à hauteur identique, un logo large (Wetlands) paraît bien plus gros qu'un
// logo compact (PRCM, dont l'emblème occupe l'essentiel de la surface).
const PARTENAIRES = [
  { nom: 'Wetlands International', logo: logoWetlands, hauteur: 34 },
  { nom: 'RAMPAO', logo: logoRampao, hauteur: 40 },
  { nom: 'PRCM', logo: logoPrcm, hauteur: 48 },
  { nom: 'BirdLife International', logo: logoBirdlife, hauteur: 44 },
];

/**
 * Connexion en deux temps : on demande un code par mail, puis on le saisit ici.
 *
 * Pas de lien cliquable. Un lien ouvre le navigateur par défaut, qui n'est pas
 * forcément celui où l'application est installée : la session se posait alors dans une
 * fenêtre que l'utilisateur n'avait pas demandée. Le code, lui, aboutit toujours ici.
 */
function Login() {
  const navigate = useNavigate();
  const { rafraichirUtilisateur } = useAuth();
  const [email, setEmail] = useState('');
  const [suivi, setSuivi] = useState(null);
  const [code, setCode] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const demanderCode = async (e) => {
    e.preventDefault();
    setErreur('');
    setEnvoiEnCours(true);
    try {
      const { data } = await api.post('/auth/demande-code/', { email });
      setSuivi(data.suivi);
    } catch (err) {
      console.error('Échec de la demande de code :', err, 'API :', api.defaults.baseURL);
      if (!err.response) {
        // Aucune réponse HTTP : backend injoignable, CORS bloqué, ou mauvaise URL d'API.
        setErreur(`Impossible de joindre le serveur (${api.defaults.baseURL}). Vérifiez qu'il est démarré et accessible.`);
      } else if (err.response.data?.detail) {
        // Adresse hors ONG, adresse mal formée : le backend dit déjà quoi faire.
        setErreur(err.response.data.detail);
      } else {
        setErreur(`Le serveur a répondu une erreur (${err.response.status}). Réessayez.`);
      }
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const validerCode = async (e) => {
    e.preventDefault();
    setErreur('');
    setEnvoiEnCours(true);
    try {
      await api.post('/auth/verifier-code/', { suivi, code });
      // Django renouvelle le jeton CSRF à la connexion : celui obtenu avant l'envoi du
      // mail ferait échouer la première réservation.
      oublierJetonCsrf();
      await rafraichirUtilisateur();
      navigate('/accueil', { replace: true });
    } catch (err) {
      setErreur(err.response?.data?.detail ?? 'Code refusé, réessayez.');
      setEnvoiEnCours(false);
    }
  };

  const recommencer = () => {
    setSuivi(null);
    setCode('');
    setErreur('');
  };

  return (
    <div className="page-connexion">
      <div className="carte-connexion">
        <div className="connexion-marque">
          <span className="connexion-embleme">
            <IconMaison size={28} />
          </span>
          <p className="connexion-nom">La Maison de la Conservation</p>
        </div>

        {suivi ? (
          <form onSubmit={validerCode}>
            <div className="icone-confirmation">
              <IconMail size={28} />
            </div>
            <h1 className="connexion-titre">Votre code</h1>
            <p className="texte-attenue">
              Un code à 6 chiffres a été envoyé à <strong>{email}</strong>. Il est valable
              15 minutes.
            </p>
            <div className="champ">
              <input
                type="text"
                className="saisie-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                aria-label="Code à 6 chiffres"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="bouton-principal bouton-pleine-largeur"
              disabled={code.length !== 6 || envoiEnCours}
            >
              {envoiEnCours ? 'Vérification…' : 'Se connecter'}
            </button>
            {erreur && <p className="texte-erreur">{erreur}</p>}
            <button type="button" className="lien-discret" onClick={recommencer}>
              Changer d'adresse ou redemander un code
            </button>
          </form>
        ) : (
          <form onSubmit={demanderCode}>
            <h1 className="connexion-titre">Connexion</h1>
            <p className="texte-attenue">
              Entrez votre email professionnel pour recevoir un code de connexion.
            </p>
            <div className="champ">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre-email@ong.org"
                required
              />
            </div>
            <button
              type="submit"
              className="bouton-principal bouton-pleine-largeur"
              disabled={envoiEnCours}
            >
              {envoiEnCours ? 'Envoi…' : 'Recevoir un code'}
            </button>
            {erreur && <p className="texte-erreur">{erreur}</p>}
          </form>
        )}

        <div className="connexion-partenaires" aria-label="ONG partenaires">
          {PARTENAIRES.map(({ nom, logo, hauteur }) => (
            <img key={nom} src={logo} alt={nom} style={{ height: `${hauteur}px` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default Login;
