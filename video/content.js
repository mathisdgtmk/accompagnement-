// ============================================================
//  CONTENU DE LA VIDÉO — c'est le seul fichier à modifier.
//  Tout ce qui est marqué "provisoire" est un texte d'attente :
//  remplace-le par tes vraies formules / vrais prix / vraies promesses.
//  *mot* entre astérisques = mot mis en valeur (doré).
// ============================================================
window.CONTENT = {
  draft: true, // true = affiche "APERÇU — TEXTES PROVISOIRES" en haut ; false pour la version finale
  fps: 30,
  bpm: 120,

  brand: {
    name: "Mathis",              // provisoire
    sub: "GROWTH LABS",          // provisoire
    monogram: "M",
    tagline: "ACCOMPAGNEMENT PREMIUM", // provisoire
    url: "imaginary-mathis-growth-labs.base44.app",
  },

  // Accroche (3 lignes max, la dernière est en violet lumineux)
  hook: ["TON BUSINESS", "MÉRITE", "MIEUX."], // provisoire

  // Promesse (laisser [] pour sauter la scène)
  promise: {
    kicker: "NOTRE PROMESSE", // provisoire
    lines: [
      "Une méthode *claire*.",
      "Un suivi *sur-mesure*.",
      "Des résultats qui *se voient*.",
    ], // provisoire
  },

  // Formules : 1 scène de 4 s par formule (3 recommandées)
  formulasTitle: "NOS FORMULES",
  formulas: [
    {
      tag: "FORMULE 01", name: "Essentiel", sub: "POUR DÉMARRER",
      price: "XX", unit: "€", // prix numérique ex. "97" => compteur animé
      bullets: ["Avantage n°1", "Avantage n°2", "Avantage n°3"],
    },
    {
      tag: "FORMULE 02", name: "Premium", sub: "LE CHOIX GAGNANT",
      price: "XX", unit: "€", featured: true, badge: "LE PLUS POPULAIRE",
      bullets: ["Tout l’Essentiel", "Avantage n°2", "Avantage n°3", "Avantage n°4"],
    },
    {
      tag: "FORMULE 03", name: "Élite", sub: "POUR ALLER LOIN",
      price: "XX", unit: "€",
      bullets: ["Tout le Premium", "Avantage n°2", "Avantage n°3", "Avantage n°4"],
    },
  ],

  // Chiffres clés (laisser [] pour sauter la scène). Ex : { value: 120, prefix: "+", suffix: "", label: "CLIENTS ACCOMPAGNÉS" }
  stats: [],

  cta: {
    lines: ["RÉSERVE", "TA PLACE"],
    button: "JE ME LANCE",
    sub: "",
  },
};
