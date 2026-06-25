export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  if (process.env.NEXT_PUBLIC_POSTHOG_ENABLED === 'true') {
    // posthog.capture(eventName, properties)
    console.log('[PostHog]', eventName, properties);
  }
};
