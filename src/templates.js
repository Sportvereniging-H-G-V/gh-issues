
function parseTemplateSections(body) {
  const sections = [];
  const blocks = body.split(/\n\s*##\s*/).filter((b) => b.trim());
  for (let i = 0; i < blocks.length; i++) {
    let block = blocks[i].trim();
    if (i === 0 && block.startsWith('##')) block = block.replace(/^#+\s*/, '');
    const firstNewline = block.indexOf('\n');
    const heading = firstNewline === -1 ? block.trim() : block.slice(0, firstNewline).trim();
    const placeholder = firstNewline === -1 ? '' : block.slice(firstNewline + 1).trim();
    if (heading) sections.push({ heading, placeholder });
  }
  return sections;
}

const RAW_TEMPLATES = [
  {
    id: 'content-wijziging',
    name: 'Content wijziging',
    titlePrefix: '[CONTENT] ',
    body: `## Betreffende pagina of sectie

Op welke pagina of in welke sectie moet de content worden gewijzigd?
(bijv. /nieuws, /teams, /contact, homepage)

## Huidige content

Beschrijf de huidige content die gewijzigd moet worden, of kopieer de tekst hier.

## Gewenste wijziging

Beschrijf duidelijk welke wijziging er gemaakt moet worden.

## Reden voor de wijziging

Waarom moet deze content worden aangepast? (bijv. verouderde informatie, fout in tekst, nieuwe gegevens)

## Aanvullende bestanden

Moeten er afbeeldingen, documenten of andere bestanden worden toegevoegd of vervangen?
- [ ] Ja (voeg ze toe als bijlage)
- [ ] Nee

## Prioriteit

- [ ] Laag – kan worden gedaan wanneer er tijd is
- [ ] Normaal – binnen een week
- [ ] Hoog – zo snel mogelijk (bijv. foutieve informatie)

## Aanvullende informatie

Voeg hier eventuele andere relevante informatie toe.`,
  },
  {
    id: 'technisch-probleem',
    name: 'Technisch probleem',
    titlePrefix: '[BUG] ',
    body: `## Beschrijving van het probleem

Geef een duidelijke beschrijving van het technische probleem.

## Stappen om het probleem te reproduceren

1. Ga naar '...'
2. Klik op '...'
3. Scroll naar '...'
4. Zie de fout

## Verwacht gedrag

Beschrijf wat je zou verwachten dat er zou moeten gebeuren.

## Huidig gedrag

Beschrijf wat er daadwerkelijk gebeurt.

## Screenshots

Voeg indien mogelijk screenshots toe om het probleem te verduidelijken.

## Omgeving

- Browser: (bijv. Chrome 120, Firefox 121)
- Besturingssysteem: (bijv. Windows 11, macOS 14, iOS 17)
- Apparaat: (bijv. desktop, mobiel, tablet)

## Aanvullende informatie

Voeg hier eventuele andere relevante informatie toe over het probleem.`,
  },
  {
    id: 'nieuwe-functie',
    name: 'Nieuwe functie',
    titlePrefix: '[FEATURE] ',
    body: `## Samenvatting

Geef een korte samenvatting van de gewenste functie.

## Probleemstelling

Welk probleem lost deze functie op, of welke behoefte vervult het?
(bijv. "Als bezoeker wil ik..., zodat ik...")

## Gewenste oplossing

Beschrijf duidelijk wat je wilt dat er gebouwd of toegevoegd wordt.

## Alternatieven overwogen

Heb je andere oplossingen overwogen? Zo ja, beschrijf ze hier.

## Voorbeelden of mockups

Voeg indien beschikbaar voorbeelden, mockups of referenties toe van vergelijkbare functionaliteit elders.

## Doelgroep

Voor welke gebruikers of bezoekers is deze functie bedoeld?
(bijv. leden, trainers, bezoekers, bestuur)

## Prioriteit

- [ ] Laag – nice to have
- [ ] Normaal – zou fijn zijn om te hebben
- [ ] Hoog – belangrijk voor de werking van de vereniging

## Aanvullende informatie

Voeg hier eventuele andere relevante informatie toe.`,
  },
];

export function getTemplates() {
  return RAW_TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    titlePrefix: t.titlePrefix || '',
    body: t.body,
    sections: parseTemplateSections(t.body),
  }));
}

