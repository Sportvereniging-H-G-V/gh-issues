import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: 'https://6ccadb68fab1cdfca74bb5c33006223c@o4511269175099392.ingest.de.sentry.io/4511269496750160',
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
