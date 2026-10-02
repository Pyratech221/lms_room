import { useState, useEffect, useCallback } from 'react';
import api from './api';
import { AuthContext } from './contexts/AuthContext';

export function AuthProvider({ children }) {
  const [utilisateur, setUtilisateur] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    api.get('/auth/utilisateur-actuel/')
      .then((response) => {
        setUtilisateur(response.data);
      })
      .catch(() => {
        setUtilisateur(null);
      })
      .finally(() => setChargement(false));
  }, []);

  // Identité stable : la page de connexion s'en sert dans une dépendance d'effet, et
  // une fonction recréée à chaque rendu y relancerait l'interrogation en boucle.
  const rafraichirUtilisateur = useCallback(() => {
    return api.get('/auth/utilisateur-actuel/')
      .then((response) => {
        setUtilisateur(response.data);
      })
      .catch(() => {
        setUtilisateur(null);
      });
  }, []);

  const deconnecter = async () => {
    try {
      await api.post('/auth/deconnexion/');
    } catch (err) {
      // Même si l'appel échoue, on oublie l'utilisateur côté client.
      console.error('Échec de la déconnexion côté serveur :', err);
    }
    setUtilisateur(null);
  };

  return (
    <AuthContext.Provider value={{ utilisateur, chargement, rafraichirUtilisateur, deconnecter }}>
      {children}
    </AuthContext.Provider>
  );
}
