// ============================================================
//  CONTENU DE LA VIDÉO — c'est le seul fichier à modifier.
//  Textes repris du site MATHISDGTMK (Starter, Premium, méthodes E-commerce et B2B).
//  *mot* entre astérisques = mot en italique.
// ============================================================
window.CONTENT = {
  fps: 30,

  brand: {
    name: "MATHISDGTMK",
    sub: "ACCOMPAGNEMENT E-COMMERCE & B2B",
    monogram: "M",
    tagline: "Pour les entrepreneurs",
    url: "mathisdgtmk.com",
  },

  // Deux phrases-manifeste (2,5 s chacune)
  statements: [
    { index: "01", lines: ["Transformer", "une boutique", "en *machine de*", "*vente* structurée."] },
    { index: "02", lines: ["Construire un", "processus", "commercial", "*qui signe.*"] },
  ],

  // Méthodes : 5 s chacune
  methods: [
    {
      title: "E-commerce",
      steps: [
        { t: "Audit", d: "Analyse de ta boutique, de ton offre et de tes tunnels de vente" },
        { t: "Offre & positionnement", d: "Offre, prix et parcours d'achat restructurés" },
        { t: "Acquisition", d: "Campagnes et canaux adaptés pour un trafic qualifié" },
        { t: "Optimisation", d: "Suivi des performances et itérations continues" },
      ],
    },
    {
      title: "B2B",
      steps: [
        { t: "Ciblage", d: "Segments, décideurs à atteindre et message de prospection" },
        { t: "Pipeline", d: "De la prise de contact jusqu'à la signature" },
        { t: "Prospection", d: "Prospection structurée et régulière" },
        { t: "Clôture & suivi", d: "Négociations, puis suivi pour fidéliser chaque client" },
      ],
    },
  ],

  // Formules : 9 s chacune (3,7 s pour les prix, puis commission et avantages)
  formulas: [
    {
      tag: "FORMULE 01", name: "Starter", sub: "ACCOMPAGNEMENT ACCESSIBLE",
      prices: [
        { value: 149, per: "/ MOIS", label: "MENSUEL" },
        { value: 1490, per: "/ AN", label: "ANNUEL" },
        { value: 2490, per: "AU TOTAL", label: "PAIEMENT UNIQUE" },
      ],
      commission: { value: "5 %", note: "sur les ventes attribuables à l'accompagnement" },
      bullets: [
        "Définition des objectifs",
        "Aide au choix du produit ou du service",
        "Création de boutique ou d'offre B2B",
        "Conseils en prospection",
        "Stratégie de contenu réseaux sociaux",
      ],
    },
    {
      tag: "FORMULE 02", name: "Premium", sub: "SUIVI INDIVIDUALISÉ", badge: "ACCOMPAGNEMENT AVANCÉ",
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
    lines: ["Choisis", "*ta formule.*"],
    button: "JE ME LANCE",
    legal: "Prestation de conseil et de soutien stratégique : aucun chiffre d'affaires ni résultat garanti.",
  },
};
