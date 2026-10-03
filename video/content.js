// ============================================================
//  CONTENU DE LA VIDÉO — c'est le seul fichier à modifier.
//  Textes repris du site MATHISDGTMK (Starter, Premium, méthodes E-commerce et B2B).
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
    url: "mathisdgtmk.com",
  },

  // Accroche : 3 phrases percutantes (1 s, 1 s puis 2 s)
  hook: [
    { small: "TON", big: "E-COMMERCE" },
    { small: "TON", big: "B2B" },
    { small: "ENFIN", big: "structurés." },
  ],

  // Méthodes : 2 s chacune, une étape par temps fort
  methods: [
    { kicker: "LA MÉTHODE", title: "E-COMMERCE", steps: ["Audit", "Offre & positionnement", "Acquisition", "Optimisation"] },
    { kicker: "LA MÉTHODE", title: "B2B", steps: ["Ciblage", "Pipeline", "Prospection", "Clôture & suivi"] },
  ],

  // Captures de ton site dans des téléphones 3D (images dans assets/)
  phonesKicker: "SUR MATHISDGTMK.COM",
  phones: [
    { img: "assets/starter.jpg", label: "STARTER" },
    { img: "assets/premium.jpg", label: "PREMIUM" },
  ],

  // Formules : les prix défilent dans l'ordre de `prices` aux instants `times` (secondes dans la scène)
  formulas: [
    {
      tag: "FORMULE 01", name: "Starter", sub: "ACCOMPAGNEMENT ACCESSIBLE", dur: 5,
      times: [0.6, 2.4, 3.6],
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
      tag: "FORMULE 02", name: "Premium", sub: "SUIVI INDIVIDUALISÉ", dur: 6,
      featured: true, badge: "ACCOMPAGNEMENT AVANCÉ",
      times: [0.6, 2.8, 4.3],
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

  cta: {
    lines: ["CHOISIS", "ta formule."],
    button: "JE ME LANCE",
    legal: "Prestation de conseil et de soutien stratégique : aucun chiffre d'affaires ni résultat garanti.",
  },
};
