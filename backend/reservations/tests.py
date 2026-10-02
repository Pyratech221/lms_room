from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from .models import CodeConnexion, Ong, Reservation, Salle, Utilisateur


class PermissionsReservationsTests(APITestCase):
    """Qui voit quoi, et qui peut trancher.

    Ces règles ne se voient pas à l'exécution : une fuite ou un droit de trop passe
    inaperçu tant que personne ne l'exploite. D'où ces tests.
    """

    def setUp(self):
        rampao = Ong.objects.create(nom='RAMPAO', domaine_email='rampao.org')
        prcm = Ong.objects.create(nom='PRCM', domaine_email='prcm.org')

        self.salle = Salle.objects.create(nom='Salle 2', capacite=9)
        self.membre = Utilisateur.objects.create_user(email='membre@rampao.org', ong=rampao)
        self.autre = Utilisateur.objects.create_user(email='autre@prcm.org', ong=prcm)
        self.admin = Utilisateur.objects.create_user(
            email='admin@pyramide-tech.com', role='ADMIN'
        )

        debut = timezone.now() + timedelta(days=7)
        self.demande_autrui = self._creer(self.autre, debut, 'EN_ATTENTE', 'Réunion confidentielle')
        self.demande_membre = self._creer(
            self.membre, debut + timedelta(hours=2), 'EN_ATTENTE', 'Ma demande'
        )
        self.refus_autrui = self._creer(
            self.autre, debut + timedelta(hours=4), 'REJETE', 'Demande refusée'
        )
        self.validee = self._creer(self.autre, debut + timedelta(hours=6), 'VALIDE', 'Comité')

    def _creer(self, utilisateur, debut, statut, objet):
        return Reservation.objects.create(
            salle=self.salle,
            utilisateur=utilisateur,
            date_heure_debut=debut,
            date_heure_fin=debut + timedelta(hours=1),
            objet=objet,
            statut=statut,
        )

    def _lister(self, utilisateur):
        self.client.force_authenticate(user=utilisateur)
        reponse = self.client.get('/api/reservations/')
        self.assertEqual(reponse.status_code, 200)
        return {element['id']: element for element in reponse.data}

    # --- Validation et refus ---

    def test_un_membre_ne_peut_pas_trancher_meme_pour_son_ong(self):
        self.client.force_authenticate(user=self.membre)
        reponse = self.client.post(
            f'/api/reservations/{self.demande_autrui.pk}/traiter/', {'action': 'valider'}
        )
        self.assertEqual(reponse.status_code, 403)
        self.demande_autrui.refresh_from_db()
        self.assertEqual(self.demande_autrui.statut, 'EN_ATTENTE')

    def test_un_membre_ne_peut_pas_trancher_sa_propre_demande(self):
        self.client.force_authenticate(user=self.membre)
        reponse = self.client.post(
            f'/api/reservations/{self.demande_membre.pk}/traiter/', {'action': 'valider'}
        )
        self.assertEqual(reponse.status_code, 403)

    def test_l_administrateur_valide(self):
        self.client.force_authenticate(user=self.admin)
        reponse = self.client.post(
            f'/api/reservations/{self.demande_autrui.pk}/traiter/', {'action': 'valider'}
        )
        self.assertEqual(reponse.status_code, 200)
        self.demande_autrui.refresh_from_db()
        self.assertEqual(self.demande_autrui.statut, 'VALIDE')
        self.assertEqual(self.demande_autrui.valide_par, self.admin)

    # --- Ce que chacun voit ---

    def test_la_demande_d_autrui_est_reduite_a_son_creneau(self):
        vues = self._lister(self.membre)
        demande = vues[self.demande_autrui.pk]

        self.assertTrue(demande['masque'])
        self.assertIsNone(demande['objet'])
        self.assertIsNone(demande['utilisateur_email'])
        self.assertIsNone(demande['utilisateur_ong'])
        # Le créneau, lui, reste visible : il bloque réellement la salle.
        self.assertIsNotNone(demande['date_heure_debut'])
        self.assertEqual(demande['salle'], self.salle.pk)

    def test_un_membre_voit_sa_propre_demande_en_entier(self):
        demande = self._lister(self.membre)[self.demande_membre.pk]
        self.assertFalse(demande['masque'])
        self.assertEqual(demande['objet'], 'Ma demande')
        self.assertEqual(demande['utilisateur_email'], 'membre@rampao.org')

    def test_un_membre_ne_voit_pas_les_refus_des_autres(self):
        self.assertNotIn(self.refus_autrui.pk, self._lister(self.membre))

    def test_les_reservations_validees_restent_visibles_de_tous(self):
        validee = self._lister(self.membre)[self.validee.pk]
        self.assertFalse(validee['masque'])
        self.assertEqual(validee['objet'], 'Comité')

    def test_l_administrateur_voit_tout_sans_masquage(self):
        vues = self._lister(self.admin)
        self.assertIn(self.refus_autrui.pk, vues)
        self.assertFalse(vues[self.demande_autrui.pk]['masque'])
        self.assertEqual(vues[self.demande_autrui.pk]['objet'], 'Réunion confidentielle')

    def test_la_liste_est_triee_par_date(self):
        dates = [element['date_heure_debut'] for element in self._lister(self.admin).values()]
        self.assertEqual(dates, sorted(dates))


class AccesConnexionTests(APITestCase):
    """Qui peut seulement demander un code.

    L'application sert quatre ONG. Sans cette barrière, n'importe quelle adresse se
    créait un compte au premier code demandé — ce qui était le cas tant que la
    connexion reposait sur un simple lien.
    """

    def setUp(self):
        Ong.objects.create(nom='RAMPAO', domaine_email='rampao.org')

    def test_une_adresse_d_une_ong_obtient_un_code(self):
        reponse = self.client.post('/api/auth/demande-code/', {'email': 'membre@rampao.org'})
        self.assertEqual(reponse.status_code, 200)
        self.assertTrue(reponse.data['suivi'])
        self.assertEqual(CodeConnexion.objects.filter(email='membre@rampao.org').count(), 1)

    def test_une_adresse_hors_ong_est_refusee(self):
        reponse = self.client.post('/api/auth/demande-code/', {'email': 'inconnu@exemple.com'})
        self.assertEqual(reponse.status_code, 403)
        # Aucune demande créée, donc aucun compte ne peut naître de cette adresse.
        self.assertFalse(CodeConnexion.objects.filter(email='inconnu@exemple.com').exists())
        self.assertFalse(Utilisateur.objects.filter(email='inconnu@exemple.com').exists())

    def test_un_compte_existant_hors_ong_garde_son_acces(self):
        # Les administrateurs et les personnes inscrites par un administrateur n'ont pas
        # d'adresse au domaine d'une ONG : les exclure fermerait la porte à tout le monde.
        Utilisateur.objects.create_user(email='admin@prestataire.com', role='ADMIN')
        reponse = self.client.post('/api/auth/demande-code/', {'email': 'admin@prestataire.com'})
        self.assertEqual(reponse.status_code, 200)

    def test_une_adresse_mal_formee_est_refusee(self):
        reponse = self.client.post('/api/auth/demande-code/', {'email': 'pas-une-adresse'})
        self.assertEqual(reponse.status_code, 400)

    def test_le_code_n_est_jamais_renvoye_au_client(self):
        reponse = self.client.post('/api/auth/demande-code/', {'email': 'membre@rampao.org'})
        code = CodeConnexion.objects.get(suivi=reponse.data['suivi']).code
        self.assertNotIn(code, str(reponse.data))


class CodeConnexionTests(APITestCase):
    """Connexion par le code du mail, quand le lien n'aboutit pas dans la bonne fenêtre.

    Six chiffres se devinent en un million d'essais : ce qui protège vraiment, c'est
    l'identifiant de suivi exigé en plus et l'extinction du jeton après quelques codes
    faux. Ces deux garde-fous ne se voient pas à l'usage, d'où ces tests.
    """

    def test_le_bon_code_connecte(self):
        jeton = CodeConnexion.generer('membre@rampao.org')
        reponse = self.client.post(
            '/api/auth/verifier-code/', {'suivi': jeton.suivi, 'code': jeton.code}
        )
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.data['email'], 'membre@rampao.org')
        jeton.refresh_from_db()
        self.assertIsNotNone(jeton.utilise_le)

    def test_le_code_ne_suffit_pas_sans_le_suivi(self):
        jeton = CodeConnexion.generer('membre@rampao.org')
        reponse = self.client.post('/api/auth/verifier-code/', {'code': jeton.code})
        self.assertEqual(reponse.status_code, 400)
        jeton.refresh_from_db()
        self.assertIsNone(jeton.utilise_le)

    def test_un_code_faux_est_refuse(self):
        jeton = CodeConnexion.generer('membre@rampao.org')
        faux = '000000' if jeton.code != '000000' else '111111'
        reponse = self.client.post(
            '/api/auth/verifier-code/', {'suivi': jeton.suivi, 'code': faux}
        )
        self.assertEqual(reponse.status_code, 400)
        jeton.refresh_from_db()
        self.assertEqual(jeton.essais, 1)

    def test_le_jeton_s_eteint_apres_trop_d_essais(self):
        jeton = CodeConnexion.generer('membre@rampao.org')
        faux = '000000' if jeton.code != '000000' else '111111'
        for _ in range(CodeConnexion.ESSAIS_MAX):
            self.client.post('/api/auth/verifier-code/', {'suivi': jeton.suivi, 'code': faux})

        # Même le bon code ne doit plus rien ouvrir : c'est le jeton qui est hors service.
        reponse = self.client.post(
            '/api/auth/verifier-code/', {'suivi': jeton.suivi, 'code': jeton.code}
        )
        self.assertEqual(reponse.status_code, 400)
        jeton.refresh_from_db()
        self.assertIsNone(jeton.utilise_le)

    def test_un_code_ne_sert_qu_une_fois(self):
        jeton = CodeConnexion.generer('membre@rampao.org')
        self.client.post('/api/auth/verifier-code/', {'suivi': jeton.suivi, 'code': jeton.code})
        self.client.logout()
        reponse = self.client.post(
            '/api/auth/verifier-code/', {'suivi': jeton.suivi, 'code': jeton.code}
        )
        self.assertEqual(reponse.status_code, 400)

    def test_le_code_est_fait_de_six_chiffres(self):
        jeton = CodeConnexion.generer('membre@rampao.org')
        self.assertRegex(jeton.code, r'^\d{6}$')
