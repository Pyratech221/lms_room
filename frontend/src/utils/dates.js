export function debutDeSemaine(date) {
  const jour = date.getDay(); // 0=dimanche, 1=lundi, ..., 6=samedi
  const decalage = jour === 0 ? -6 : 1 - jour; // ramène toujours au lundi
  const lundi = new Date(date);
  lundi.setDate(date.getDate() + decalage);
  lundi.setHours(0, 0, 0, 0);
  return lundi;
}

export function joursDeLaSemaine(lundi) {
  return Array.from({ length: 5 }, (_, i) => {
    const jour = new Date(lundi);
    jour.setDate(lundi.getDate() + i);
    return jour;
  });
}

export function formatDateAffichage(date) {
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
}

export function estMemeJour(date1, date2) {
  return date1.toDateString() === date2.toDateString();
}

