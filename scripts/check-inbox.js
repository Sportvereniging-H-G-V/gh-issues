#!/usr/bin/env node
/**
 * Haal ongelezen e-mails op uit de IMAP-inbox (voor HelpdeskAgent replies).
 *
 * Gebruik:
 *   node scripts/check-inbox.js [--mark-read]
 *
 * Vereiste env vars:
 *   IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASS
 *
 * Optionele env vars:
 *   IMAP_TLS   "false" om TLS uit te schakelen (standaard: true)
 *   IMAP_MAILBOX   map om te lezen (standaard: INBOX)
 *
 * Uitvoer: JSON-array van berichten naar stdout.
 *   [{ from, to, subject, date, text, html, uid }]
 *
 * Gebruik --mark-read om berichten na lezen als gelezen te markeren.
 */

import imapSimple from 'imap-simple';

const markRead = process.argv.includes('--mark-read');

const { IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASS, IMAP_TLS = 'true', IMAP_MAILBOX = 'INBOX' } = process.env;
if (!IMAP_HOST || !IMAP_PORT || !IMAP_USER || !IMAP_PASS) {
  console.error('Fout: IMAP_HOST, IMAP_PORT, IMAP_USER en IMAP_PASS zijn verplicht.');
  process.exit(2);
}

const config = {
  imap: {
    host: IMAP_HOST,
    port: Number(IMAP_PORT),
    tls: IMAP_TLS !== 'false',
    user: IMAP_USER,
    password: IMAP_PASS,
    authTimeout: 10000,
  },
};

let connection;
try {
  connection = await imapSimple.connect(config);
  await connection.openBox(IMAP_MAILBOX);

  const searchCriteria = ['UNSEEN'];
  const fetchOptions = {
    bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
    markSeen: markRead,
  };

  const messages = await connection.search(searchCriteria, fetchOptions);

  const results = messages.map((msg) => {
    const header = msg.parts.find((p) => p.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE)')?.body || {};
    const text = msg.parts.find((p) => p.which === 'TEXT')?.body || '';
    return {
      uid: msg.attributes.uid,
      from: (header.from || [''])[0],
      to: (header.to || [''])[0],
      subject: (header.subject || [''])[0],
      date: (header.date || [''])[0],
      text: (Buffer.isBuffer(text) ? text.toString('utf8') : String(text)).slice(0, 8192),
    };
  });

  console.log(JSON.stringify(results, null, 2));
} catch (err) {
  console.error(JSON.stringify({ ok: false, error: err.message }));
  process.exit(3);
} finally {
  connection?.end();
}
