const PRIORITE_SALLE_1 = {
  1: 'RAMPAO',    // lundi (getDay() = 1)
  2: 'WIACO',     // mardi
  3: 'BirdLife',  // mercredi
  4: 'PRCM',      // jeudi
};

/** Seul un administrateur valide ou rejette une demande.
 *
 * Appartenir à l'ONG prioritaire du jour ne donne aucun droit d'arbitrage : la priorité
 * décide du statut initial d'une réservation, pas de qui la tranche. L'API applique la
 * même règle — ce contrôle ne fait que masquer des boutons inutiles.
 */
export function peutTraiter(utilisateur) {
  return utilisateur?.role === 'ADMIN';
}

// Retourne l'ONG prioritaire pour une date donnée (lundi-jeudi), ou null
// le vendredi/week-end où aucune priorité ne s'applique.
export function ongPrioritaireDuJour(date) {
  return PRIORITE_SALLE_1[date.getDay()] ?? null;
}