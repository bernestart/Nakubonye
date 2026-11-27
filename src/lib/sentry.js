import * as Sentry from "@sentry/react";

export function initSentry() {
  // We only init if we have a DSN. 
  // You can get a free DSN at sentry.io
  const DSN = import.meta.env.VITE_SENTRY_DSN; 
  
  if (!DSN) {
    console.warn("Sentry DSN not found. Skipping Sentry init.");
    return;
  }

  Sentry.init({
    dsn: DSN,
    integrations: [
      new Sentry.BrowserTracing(),
      new Sentry.Replay(),
    ],
    // Performance Monitoring
    tracesSampleRate: 0.1, // Capture 10% of transactions for performance (keeps costs down)
    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
  });
}
