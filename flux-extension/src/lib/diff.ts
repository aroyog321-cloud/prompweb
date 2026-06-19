/**
 * Word-level diff using longest-common-subsequence.
 * Returns indices of "kept" words for both sides plus additions/removals.
 *
 * Tokenization: split on whitespace, keep the whitespace as a trailing token
 * so re-rendering preserves the original spacing.
 */

export type DiffSide = {
  tokens: string[]; // alternating word, ws, word, ws, ...
  kept: Set<number>; // indices of tokens present in both sides
};

export type DiffResult = {
  original: DiffSide;
  optimized: DiffSide;
};

function tokenize(s: string): string[] {
  if (!s) return [];
  // Split on whitespace boundaries, keep the whitespace as its own token.
  return s.match(/\S+|\s+/g) ?? [];
}

/** Build an LCS table and walk it back to find the kept indices on each side. */
function lcsKept(a: string[], b: string[]): { aKept: Set<number>; bKept: Set<number> } {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return { aKept: new Set(), bKept: new Set() };

  // Build LCS length table (rows = a+1, cols = b+1).
  // Use a typed array for speed; values are small integers.
  const dp: Uint32Array = new Uint32Array((n + 1) * (m + 1));
  const stride = m + 1;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i * stride + j] = dp[(i - 1) * stride + (j - 1)] + 1;
      } else {
        dp[i * stride + j] = Math.max(
          dp[(i - 1) * stride + j],
          dp[i * stride + (j - 1)]
        );
      }
    }
  }

  // Walk back to find the kept indices.
  const aKept = new Set<number>();
  const bKept = new Set<number>();
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      aKept.add(i - 1);
      bKept.add(j - 1);
      i--;
      j--;
    } else if (dp[(i - 1) * stride + j] >= dp[i * stride + (j - 1)]) {
      i--;
    } else {
      j--;
    }
  }
  return { aKept, bKept };
}

export function diffWords(original: string, optimized: string): DiffResult {
  const a = tokenize(original);
  const b = tokenize(optimized);
  const { aKept, bKept } = lcsKept(a, b);

  return {
    original: { tokens: a, kept: aKept },
    optimized: { tokens: b, kept: bKept }
  };
}
