// ============================================================
//  CONTENU DE LA VIDÉO — c'est le seul fichier à modifier.
//  Textes repris du site (Starter, Premium, méthodes E-commerce et B2B).
//  *mot* entre astérisques = mot mis en valeur (doré) dans la scène "promise".
// ============================================================
window.CONTENT = {
  draft: false, // true = affiche "APERÇU — TEXTES PROVISOIRES" en haut
  fps: 30,
  bpm: 120,

  brand: {
    name: "MATHISDGTMK",
    sub: "ACCOMPAGNEMENT E-COMMERCE & B2B",
    monogram: "M",
    tagline: "POUR LES ENTREPRENEURS",
    url: "imaginary-mathis-growth-labs.base44.app",
  },

  // Accroche (la dernière ligne est en violet lumineux)
  hook: ["TA BOUTIQUE", "EN MACHINE", "de vente."],

  // Scène "promesse" désactivée (lines vide)
  promise: { kicker: "", lines: [] },

  // Méthodes : 1 scène de 4 s chacune
  methods: [
    {
      kicker: "LA MÉTHODE",
      title: "E-COMMERCE",
      sub: "Transformer une boutique en machine de vente structurée.",
      steps: [
        { t: "Audit", d: "Analyse de ta boutique, de ton offre et de tes tunnels de vente" },
        { t: "Offre & positionnement", d: "Offre, prix et parcours d'achat restructurés" },
        { t: "Acquisition", d: "Campagnes et canaux adaptés pour un trafic qualifié" },
        { t: "Optimisation", d: "Suivi des performances et itérations continues" },
      ],
    },
    {
      kicker: "LA MÉTHODE",
      title: "B2B",
      sub: "Construire un processus commercial qui signe.",
      steps: [
        { t: "Ciblage", d: "Segments, décideurs à atteindre et message de prospection" },
        { t: "Pipeline", d: "Un processus clair, de la prise de contact à la signature" },
        { t: "Prospection", d: "Prospection structurée et régulière" },
        { t: "Clôture & suivi", d: "Négociations, puis suivi pour fidéliser chaque client" },
      ],
    },
  ],

  // Formules : 1 scène de 7 s par formule. Les prix défilent dans l'ordre de `prices`.
  formulasTitle: "NOS FORMULES",
  formulas: [
    {
      tag: "FORMULE 01", name: "Starter", sub: "ACCOMPAGNEMENT ACCESSIBLE",
      prices: [
        { value: 149, per: "/ MOIS", label: "MENSUEL" },
        { value: 1490, per: "/ AN", label: "ANNUEL" },
        { value: 2490, per: "AU TOTAL", label: "PAIEMENT UNIQUE" },
      ],
      commission: { value: "5 %", note: "sur les ventes attribuables" },
      bullets: [
        "Définition des objectifs",
        "Aide au choix du produit ou du service",
        "Création de boutique ou d'offre B2B",
        "Conseils en prospection",
        "Stratégie de contenu réseaux sociaux",
      ],
    },
    {
      tag: "FORMULE 02", name: "Premium", sub: "SUIVI INDIVIDUALISÉ",
      featured: true, badge: "ACCOMPAGNEMENT AVANCÉ",
      prices: [
        { value: 599, per: "/ MOIS", label: "MENSUEL" },
        { value: 5990, per: "/ AN", label: "ANNUEL" },
        { value: 9990, per: "AU TOTAL", label: "PAIEMENT UNIQUE" },
      ],
      commission: { value: "0 %", note: "sur les ventes" },
      bullets: [
        "Tous les avantages du Starter",
        "Stratégie personnalisée",
        "Système de prospection",
        "2 rendez-vous individuels par semaine",
        "Analyse des performances",
      ],
    },
  ],

  stats: [],

  cta: {
    lines: ["CHOISIS", "TA FORMULE"],
    button: "JE ME LANCE",
    sub: "",
    legal: "Prestation de conseil et de soutien stratégique : aucun chiffre d'affaires ni résultat garanti.",
  },
};
