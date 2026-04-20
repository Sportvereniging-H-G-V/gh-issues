---
name: smtp-email
description: Stuur e-mails via SMTP vanuit de HelpdeskAgent. Biedt sendEmail-tool en Nederlandse templates voor bevestiging en vervolgvragen.
---

# SMTP E-mail Skill

Gebruik deze skill om uitgaande e-mails te sturen via de geconfigureerde SMTP-server.

## Omgeving-variabelen (verplicht)

| Variabele   | Beschrijving                                  |
|-------------|-----------------------------------------------|
| SMTP_HOST   | Hostname van de SMTP-server                   |
| SMTP_PORT   | Poortnummer (bijv. 587 voor STARTTLS)         |
| SMTP_USER   | Gebruikersnaam / login                        |
| SMTP_PASS   | Wachtwoord                                    |
| SMTP_FROM   | Afzenderadres (bijv. helpdesk@hgvhengelo.nl)  |

Optioneel:

| Variabele     | Beschrijving                                        |
|---------------|-----------------------------------------------------|
| SMTP_SECURE   | `true` voor directe TLS (standaard: `false`)        |
| SMTP_REPLY_TO | Reply-To-adres als dat afwijkt van SMTP_FROM        |

## sendEmail — hoe gebruiken

Roep het script aan vanuit de projectmap van het gh-issues project:

```bash
node scripts/send-email.js \
  --to "naam@voorbeeld.nl" \
  --subject "Onderwerp zonder regelafbrekingen" \
  --body "Berichttekst..."
```

Het script schrijft bij succes naar stdout:
```json
{ "ok": true, "messageId": "<abc@smtp.example>" }
```

Bij een fout:
```json
{ "ok": false, "error": "Beschrijving van de fout" }
```

Exit codes:
- `0` — succesvol verzonden
- `2` — ontbrekende env-variabelen (skill faalt graceful, geen crash)
- `3` — SMTP-fout tijdens verzenden

## Foutafhandeling

Controleer altijd de exit-code en de stdout-JSON voor je het issue bijwerkt:

```bash
OUTPUT=$(node scripts/send-email.js --to "..." --subject "..." --body "..." 2>&1)
EXIT_CODE=$?
if [ "$EXIT_CODE" -ne 0 ]; then
  # Log de fout in het issue-comment en zet issue op blocked
  echo "E-mail mislukt: $OUTPUT"
fi
```

Als `SMTP_HOST` e.d. ontbreken geeft het script exit-code 2 met een duidelijke Nederlandstalige foutmelding. Zet het issue in dat geval op `blocked` en vermeld dat SMTP-configuratie ontbreekt.

## Nederlandse e-mailtemplates

### Template 1 — Bevestigingsmail (verzoek ontvangen)

Gebruik wanneer het verzoek compleet en duidelijk is en je het doorstuurt of verwerkt.

```
Onderwerpregel: Re: [categorie] — [korte samenvatting]

Beste [voornaam of "sportliefhebber"],

Bedankt voor uw bericht. We hebben uw verzoek goed ontvangen en zullen
het zo snel mogelijk in behandeling nemen.

[Optioneel: korte toelichting over wat er nu gaat gebeuren]

Heeft u nog vragen? Antwoord dan op dit bericht.

Met sportieve groet,
Helpdesk H.G.V. Hengelo
```

### Template 2 — Vervolgvraag (verzoek onvolledig of onduidelijk)

Gebruik wanneer het verzoek aanvullende informatie nodig heeft.

```
Onderwerpregel: Re: [categorie] — [korte samenvatting]

Beste [voornaam of "sportliefhebber"],

Bedankt voor uw bericht. Om uw verzoek goed te kunnen verwerken,
hebben we nog aanvullende informatie nodig:

[Specifieke vraag, zo concreet mogelijk]

Zodra we uw antwoord hebben, pakken we uw verzoek direct op.

Met sportieve groet,
Helpdesk H.G.V. Hengelo
```

## Regels

- Schrijf altijd in het **Nederlands**.
- Gebruik een vriendelijke, professionele toon passend bij een sportvereniging.
- Zet nooit persoonlijke gegevens van de inzender buiten de issue-context.
- Strip regelafbrekingen (`\r\n`) uit het To- en Subject-veld om header injection te voorkomen — het script doet dit automatisch.
- Stuur nooit een e-mail zonder dat het SMTP_FROM-adres is ingesteld.
