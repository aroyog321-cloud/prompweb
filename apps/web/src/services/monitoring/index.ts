export const captureError = (error: Error | unknown, context?: Record<string, any>) => {
  if (process.env.NEXT_PUBLIC_SENTRY_ENABLED === 'true') {
    // Sentry.captureException(error, { extra: context })
    console.error('[Sentry]', error, context);
  } else {
    console.error(error, context);
  }
};
