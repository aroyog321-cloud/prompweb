import { OptimizeRequest } from '@promptly/types';

export function validateOptimizeRequest(bodyText: string): { body: OptimizeRequest | null, error: string | null, status: number } {
  let body: OptimizeRequest;
  try {
    body = JSON.parse(bodyText) as OptimizeRequest;
  } catch (parseError) {
    return { body: null, error: "Invalid JSON in request body", status: 400 };
  }

  if (!body.text || !body.mode || !body.level) {
    return { body: null, error: "Missing required fields", status: 400 };
  }

  if (body.text.length > 8000) {
    return { body: null, error: "Prompt too long. Maximum 8,000 characters.", status: 400 };
  }

  if (body.refinement && body.refinement.length > 1000) {
    return { body: null, error: "Refinement instruction too long. Maximum 1,000 characters.", status: 400 };
  }

  if (body.context) {
    for (const [field, value] of Object.entries(body.context)) {
      if (typeof value === 'string' && value.length > 500) {
        return { body: null, error: `Context field '${field}' too long. Maximum 500 characters.`, status: 400 };
      }
    }
    if (body.context.websiteUrl) {
      try { new URL(body.context.websiteUrl); } catch {
        body.context.websiteUrl = '';
      }
    }
  }

  return { body, error: null, status: 200 };
}
