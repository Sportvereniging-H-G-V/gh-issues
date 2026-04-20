
const RAW_TEMPLATES = [
  {
    id: 'content-wijziging',
    name: 'Content wijziging',
    titlePrefix: '[CONTENT] ',
    sections: [
      {
        heading: 'Betreffende pagina of sectie',
        placeholder:
          'Op welke pagina of in welke sectie moet de content worden gewijzigd?\n(bijv. /nieuws, /teams, /contact, homepage)',
        required: true,
      },
      {
        heading: 'Huidige content',
        placeholder:
          'Beschrijf de huidige content die gewijzigd moet worden, of kopieer de tekst hier.',
        required: false,
      },
      {
        heading: 'Gewenste wijziging',
        placeholder: 'Beschrijf duidelijk welke wijziging er gemaakt moet worden.',
        required: true,
      },
      {
        heading: 'Reden voor de wijziging',
        placeholder:
          'Waarom moet deze content worden aangepast?\n(bijv. verouderde informatie, fout in tekst, nieuwe gegevens)',
        required: false,
      },
      {
        heading: 'Aanvullende informatie',
        placeholder: 'Voeg hier eventuele andere relevante informatie toe.',
        required: false,
      },
    ],
  },
  {
    id: 'technisch-probleem',
    name: 'Technisch probleem',
    titlePrefix: '[BUG] ',
    sections: [
      {
        heading: 'Beschrijving van het probleem',
        placeholder: 'Geef een duidelijke beschrijving van het technische probleem.',
        required: true,
      },
      {
        heading: 'Stappen om het probleem te reproduceren',
        placeholder: '1. Ga naar \'...\'\n2. Klik op \'...\'\n3. Scroll naar \'...\'\n4. Zie de fout',
        required: false,
      },
      {
        heading: 'Verwacht gedrag',
        placeholder: 'Beschrijf wat je zou verwachten dat er zou moeten gebeuren.',
        required: true,
      },
      {
        heading: 'Huidig gedrag',
        placeholder: 'Beschrijf wat er daadwerkelijk gebeurt.',
        required: true,
      },
      {
        heading: 'Omgeving',
        placeholder:
          'Browser: (bijv. Chrome 120, Firefox 121)\nBesturingssysteem: (bijv. Windows 11, macOS 14, iOS 17)\nApparaat: (bijv. desktop, mobiel, tablet)',
        required: false,
      },
      {
        heading: 'Aanvullende informatie',
        placeholder: 'Voeg hier eventuele andere relevante informatie toe over het probleem.',
        required: false,
      },
    ],
  },
  {
    id: 'nieuwe-functie',
    name: 'Nieuwe functie',
    titlePrefix: '[FEATURE] ',
    sections: [
      {
        heading: 'Samenvatting',
        placeholder: 'Geef een korte samenvatting van de gewenste functie.',
        required: true,
      },
      {
        heading: 'Probleemstelling',
        placeholder:
          'Welk probleem lost deze functie op, of welke behoefte vervult het?\n(bijv. "Als bezoeker wil ik..., zodat ik...")',
        required: true,
      },
      {
        heading: 'Gewenste oplossing',
        placeholder: 'Beschrijf duidelijk wat je wilt dat er gebouwd of toegevoegd wordt.',
        required: false,
      },
      {
        heading: 'Doelgroep',
        placeholder:
          'Voor welke gebruikers of bezoekers is deze functie bedoeld?\n(bijv. leden, trainers, bezoekers, bestuur)',
        required: false,
      },
      {
        heading: 'Aanvullende informatie',
        placeholder: 'Voeg hier eventuele andere relevante informatie toe.',
        required: false,
      },
    ],
  },
];

export function getTemplates() {
  return RAW_TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    titlePrefix: t.titlePrefix || '',
    sections: t.sections,
  }));
}
