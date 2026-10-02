import axios from 'axios';

// URL du backend. Par défaut relative : le front et l'API sont servis sous le même
// domaine (nginx en conteneur, proxy Vite en développement), donc pas de CORS ni de
// cookies cross-site. VITE_API_URL permet de pointer ailleurs si besoin.
const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// Quand le frontend et le backend sont sur des domaines différents (tunnel, production),
// le cookie csrftoken appartient au domaine du backend : le JS du frontend ne peut pas
// le lire via document.cookie. On récupère alors le jeton via l'API et on le garde en mémoire.
let jetonCsrf = null;

async function obtenirJetonCsrf() {
  if (jetonCsrf) return jetonCsrf;

  const jetonCookie = getCookie('csrftoken');
  if (jetonCookie) {
    jetonCsrf = jetonCookie;
    return jetonCsrf;
  }

  // axios brut (et non `api`) pour ne pas repasser par cet intercepteur.
  const { data } = await axios.get(`${BASE_URL}/auth/csrf/`, { withCredentials: true });
  jetonCsrf = data.csrf_token;
  return jetonCsrf;
}

/** Django renouvelle le jeton CSRF à la connexion : celui gardé ici devient périmé. */
export function oublierJetonCsrf() {
  jetonCsrf = null;
}

const METHODES_PROTEGEES = ['post', 'put', 'patch', 'delete'];

api.interceptors.request.use(async (config) => {
  if (METHODES_PROTEGEES.includes((config.method ?? 'get').toLowerCase())) {
    try {
      const jeton = await obtenirJetonCsrf();
      if (jeton) config.headers['X-CSRFToken'] = jeton;
    } catch {
      // On laisse la requête partir : le backend répondra 403 et l'appelant gérera l'erreur.
    }
  }
  return config;
});

// Un jeton périmé (session renouvelée, redéploiement) renvoie 403 : on l'oublie
// pour qu'il soit redemandé à la tentative suivante.
api.interceptors.response.use(
  (reponse) => reponse,
  (erreur) => {
    if (erreur.response?.status === 403) {
      jetonCsrf = null;
    }
    return Promise.reject(erreur);
  }
);

export default api;
