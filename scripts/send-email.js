#!/usr/bin/env node
/**
 * Stuur een e-mail via de geconfigureerde SMTP-server.
 *
 * Gebruik:
 *   node scripts/send-email.js \
 *     --to "naam@voorbeeld.nl" \
 *     --subject "Onderwerp" \
 *     --body "Berichttekst (mag meerdere regels bevatten)"
 *
 * Vereiste env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * Optionele env vars:
 *   SMTP_SECURE   "true" voor TLS (standaard: false, STARTTLS via port 587)
 *   SMTP_REPLY_TO adres voor Reply-To header
 */

import nodemailer from 'nodemailer';

function usage() {
  console.error('Gebruik: node scripts/send-email.js --to <adres> --subject <tekst> --body <tekst>');
  process.exit(1);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    const val = argv[i + 1];
    if (!key || val === undefined) usage();
    args[key] = val;
  }
  return args;
}

const { to, subject, body } = parseArgs(process.argv);
if (!to || !subject || !body) usage();

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE, SMTP_REPLY_TO } = process.env;
if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
  console.error('Fout: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS en SMTP_FROM zijn verplicht.');
  process.exit(2);
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: SMTP_SECURE === 'true',
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

const mail = {
  from: SMTP_FROM,
  to,
  subject,
  text: body,
  ...(SMTP_REPLY_TO ? { replyTo: SMTP_REPLY_TO } : {}),
};

try {
  const info = await transporter.sendMail(mail);
  console.log(JSON.stringify({ ok: true, messageId: info.messageId }));
} catch (err) {
  console.error(JSON.stringify({ ok: false, error: err.message }));
  process.exit(3);
}
