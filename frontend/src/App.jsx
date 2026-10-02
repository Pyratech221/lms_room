import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Accueil from './pages/Accueil';
import Calendrier from './pages/Calendrier';
import Administration from './pages/Administration';
import Affichage from './pages/Affichage';
import RouteProtegee from './components/RouteProtegee';

function App() {
  return (
    <Routes>
      {/* La racine renvoie vers l'accueil, qui redirige lui-même vers /login si la session est absente. */}
      <Route path="/" element={<Navigate to="/accueil" replace />} />
      <Route path="/login" element={<Login />} />
      {/* Écran mural du hall : volontairement hors RouteProtegee — un écran accroché
          dans un couloir ne peut pas se connecter. L'API ne lui sert qu'un horaire
          et une ONG, jamais un nom ni un objet de réunion. */}
      <Route path="/affichage" element={<Affichage />} />
      <Route
        path="/accueil"
        element={
          <RouteProtegee>
            <Accueil />
          </RouteProtegee>
        }
      />
      <Route
        path="/calendrier"
        element={
          <RouteProtegee>
            <Calendrier />
          </RouteProtegee>
        }
      />
      <Route
        path="/administration"
        element={
          <RouteProtegee>
            <Administration />
          </RouteProtegee>
        }
      />
      {/* Toute URL inconnue retombe sur la racine. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
