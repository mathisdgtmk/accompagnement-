// ============================================================
//  CONTENU DE LA PUB — c'est le seul fichier à modifier pour changer les textes.
//  Les écrans de téléphone sont des ILLUSTRATIONS du service (pas des captures d'une vraie appli) : ils reprennent
//  uniquement ce qui est déjà sur le site MATHISDGTMK (objectifs, aide au choix du produit, création de boutique /
//  offre B2B, méthode étape par étape, rendez-vous individuels et analyse des performances en formule Premium).
//  Aucun chiffre d'affaires ni résultat n'est affiché.
// ============================================================
window.CONTENT = {
  brand: { name: "MATHISDGTMK", monogram: "M" },

  // Bulle de texte en haut de l'écran (comme sur TikTok) : change à chaque temps fort. t = secondes.
  captions: [
    { t0: 0.30, t1: 4.10, lines: ["Arrête de procrastiner ⏰"] },
    { t0: 4.30, t1: 8.10, lines: ["Fixe ton objectif 🎯"] },
    { t0: 8.30, t1: 12.10, lines: ["Planifie chaque étape 🧭"] },
    { t0: 12.30, t1: 16.10, lines: ["Avance avec un suivi", "chaque semaine 📈"] },
    { t0: 16.30, t1: 21.05, lines: ["Réserve ton appel", "lien en bio ☝️"] },
  ],

  // Écran 0 : la liste « à faire » que tout le monde repousse
  todo: {
    title: "À faire", label: "AUJOURD’HUI", tag: "demain",
    items: ["Lancer ma boutique", "Contacter mes premiers clients", "Créer mon offre", "Planifier ma semaine"],
    footer: "4 tâches repoussées",
  },
  // Écran 1 : objectif de la semaine
  goal: {
    title: "Ma semaine", label: "OBJECTIF DE LA SEMAINE", fieldLabel: "MON OBJECTIF", value: "Lancer ma boutique",
    checks: ["Objectifs définis", "Produit ou service choisi", "Boutique ou offre B2B créée"], button: "Définir mon objectif",
  },
  // Écran 2 : plan étape par étape (méthode e-commerce du site)
  plan: { title: "Mon plan", label: "E-COMMERCE · ÉTAPE PAR ÉTAPE", unit: "du plan", steps: ["Audit", "Offre & positionnement", "Acquisition", "Optimisation"] },
  // Carte qui se dresse hors de l'écran
  card: { label: "PLAN COMPLÉTÉ", title: "Boutique en ligne", value: "4 / 4", unit: "étapes", sub: "Audit · Offre · Acquisition · Optimisation" },
  // Écran 3 : suivi individualisé (formule Premium)
  follow: {
    title: "Cette semaine", label: "SUIVI INDIVIDUALISÉ · PREMIUM", days: ["L", "M", "M", "J", "V", "S", "D"],
    meetings: [{ t: "Rendez-vous individuel", d: "Mardi · 10:00", day: 1 }, { t: "Rendez-vous individuel", d: "Vendredi · 10:00", day: 4 }],
    chart: "ANALYSE DES PERFORMANCES",
  },

  end: { button: "Réserve ton appel", legal: "Prestation de conseil et de soutien stratégique : aucun chiffre d’affaires ni résultat garanti." },
};
