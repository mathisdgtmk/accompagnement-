// ============================================================
//  CONTENU DE LA PUB — c'est le seul fichier à modifier pour changer les textes.
//  Les écrans de téléphone sont des ILLUSTRATIONS du service : ils reprennent uniquement ce qui est déjà
//  sur le site MATHISDGTMK (objectifs, aide au choix du produit, création de boutique / offre B2B,
//  méthode étape par étape, rendez-vous individuels et analyse des performances en formule Premium).
//  Aucun chiffre d'affaires ni résultat n'est affiché.
// ============================================================
window.CONTENT = {
  fps: 30,

  brand: {
    name: "MATHISDGTMK",
    sub: "ACCOMPAGNEMENT E-COMMERCE & B2B",
    monogram: "M",
    url: "mathisdgtmk.com",
  },

  // En-tête fixe en haut de l'écran (icône + phrase d'accroche), comme les vidéos « animation d'appli »
  header: { title: "Arrête de procrastiner", emoji: "⏰" },

  // Accroche : « demain » est rayé, puis la marque éclate
  hook: { word: "Demain." },

  // Carte en points : du point de départ à l'objectif
  terrain: { from: "Aujourd’hui", to: "Ton objectif" },

  // Mots-chocs, un par écran de téléphone
  words: { goal: "Fixe.", plan: "Planifie.", follow: "Avance.", formulas: "Choisis ta formule." },

  screens: {
    goal: {
      nav: "Ma semaine",
      label: "OBJECTIF DE LA SEMAINE",
      value: "Lancer ma boutique",
      checks: ["Objectifs définis", "Produit ou service choisi", "Boutique ou offre B2B créée"],
      button: "Définir mon objectif",
      pill: "Objectif défini",
    },
    plan: {
      nav: "Mon plan",
      label: "E-COMMERCE · ÉTAPE PAR ÉTAPE",
      steps: ["Audit", "Offre & positionnement", "Acquisition", "Optimisation"],
      pill: "4 étapes, 1 chemin",
    },
    follow: {
      nav: "Cette semaine",
      label: "SUIVI INDIVIDUALISÉ",
      days: ["L", "M", "M", "J", "V", "S", "D"],
      meetings: [{ t: "Rendez-vous individuel", d: "Mardi · 10:00", day: 1 }, { t: "Rendez-vous individuel", d: "Vendredi · 10:00", day: 4 }],
      chart: "Analyse des performances",
      pill: "2 rendez-vous / semaine",
      pillTag: "PREMIUM",
    },
  },

  // Les deux formules (sans prix : le détail est sur le site)
  formulas: [
    { tag: "FORMULE 01", name: "Starter", sub: "ACCOMPAGNEMENT ACCESSIBLE", lines: ["Définition des objectifs", "Conseils en prospection"] },
    { tag: "FORMULE 02", name: "Premium", sub: "SUIVI INDIVIDUALISÉ", lines: ["Stratégie personnalisée", "2 rendez-vous par semaine"] },
  ],

  end: {
    tagline: ["Ton cadre", "pour passer", "à l’action."],
    button: "RÉSERVE TON APPEL",
    link: "Lien en bio",
    legal: "Prestation de conseil et de soutien stratégique : aucun chiffre d’affaires ni résultat garanti.",
  },
};
