export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Environment variable ${name} is missing.`);
    } else {
      console.warn(`[DEV WARNING] Environment variable ${name} is missing.`);
      return "";
    }
  }
  return value;
}
