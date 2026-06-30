import { OptimizeRequest, RewriteLevel } from '@promptly/types';

// These sets mirror PROMPT_MODES and REWRITE_LEVELS in @promptly/types exactly.
// If you add a new mode/level to the types, add it here too.
const VALID_MODES = new Set<string>([
  'auto',
  'general',
  'developer',
  'designer',        // ← was missing
  'marketing',       // ← was missing  
  'research',        // ← was missing
  'business',        // ← was missing
  'content-creator', // ← was missing
  'startup-founder',
]);

const VALID_LEVELS = new Set<string>([
  // Current levels (from @promptly/types RewriteLevel)
  'Basic',
  'Professional',
  'Staff+',
  'Research',
  'Production Audit',
  // Legacy values kept so old cached extension settings don't break
  'light',
  'medium',
  'aggressive',
  'expert',
]);

// Levels that trigger two-pass optimization — used for size guard below.
const TWO_PASS_LEVELS = new Set(['Staff+', 'Research', 'Production Audit']);

// Two-pass doubles Gemini cost and latency; cap input at 4k chars to prevent
// empty-response safety blocks on very large prompts.
const TWO_PASS_MAX_CHARS = 4000;

export function validateOptimizeRequest(
  bodyText: string
): { body: OptimizeRequest | null; error: string | null; status: number } {
  const MAX_BYTES = Number(process.env.MAX_OPTIMIZE_REQUEST_BYTES ?? 65536);
  if (new TextEncoder().encode(bodyText).length > MAX_BYTES) {
    return { body: null, error: 'Payload too large', status: 413 };
  }

  let body: OptimizeRequest;
  try {
    body = JSON.parse(bodyText) as OptimizeRequest;
  } catch {
    return { body: null, error: 'Invalid JSON in request body', status: 400 };
  }

  if (!body.text || !body.mode || !body.level) {
    return { body: null, error: 'Missing required fields: text, mode, level', status: 400 };
  }

  if (!body.mode || !VALID_MODES.has(body.mode.toLowerCase())) {
    return {
      body: null,
      error: `Invalid mode '${body.mode}'. Valid: ${[...VALID_MODES].join(', ')}`,
      status: 400,
    };
  }

  if (!body.level || !Array.from(VALID_LEVELS).map(l => l.toLowerCase()).includes(body.level.toLowerCase())) {
    return {
      body: null,
      error: `Invalid level '${body.level}'. Valid: ${[...VALID_LEVELS].join(', ')}`,
      status: 400,
    };
  }

  // Normalize level casing to ensure downstream code gets exact expected keys
  const exactLevelMatch = Array.from(VALID_LEVELS).find(l => l.toLowerCase() === body.level.toLowerCase());
  if (exactLevelMatch) body.level = exactLevelMatch as RewriteLevel;

  // Strip control characters
  body.text = body.text.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '').trim();

  if (body.text.length > 8000) {
    return { body: null, error: 'Prompt too long. Maximum 8,000 characters.', status: 400 };
  }

  // Two-pass safety guard: very long inputs at Staff+/Research/Production Audit
  // frequently trigger Gemini safety blocks, which surface as a 500.
  // Clamp rather than reject so the user still gets a result.
  if (TWO_PASS_LEVELS.has(body.level) && body.text.length > TWO_PASS_MAX_CHARS) {
    body.text = body.text.slice(0, TWO_PASS_MAX_CHARS);
  }

  if (body.refinement && body.refinement.length > 1000) {
    return { body: null, error: 'Refinement too long. Maximum 1,000 characters.', status: 400 };
  }

  if (body.context) {
    for (const [field, value] of Object.entries(body.context)) {
      if (typeof value === 'string' && value.length > 500) {
        return {
          body: null,
          error: `Context field '${field}' too long. Maximum 500 characters.`,
          status: 400,
        };
      }
    }
    if (body.context.websiteUrl) {
      try {
        new URL(body.context.websiteUrl);
      } catch {
        body.context.websiteUrl = '';
      }
    }
  }

  return { body, error: null, status: 200 };
}
