import React, { useMemo } from 'react';
import { diffWords } from '../lib/diff';

interface DiffViewProps {
  original: string;
  optimized: string;
  onCherryPick?: (text: string) => void;
}

export const DiffView: React.FC<DiffViewProps> = ({ original, optimized, onCherryPick }) => {
  const diffResult = useMemo(() => diffWords(original, optimized), [original, optimized]);

  return (
    <div className="promptly-diff">
      <div className="promptly-diff-col original">
        <div className="col-header">Original</div>
        <div>
          {diffResult.original.tokens.map((token, i) => {
            const isWhitespace = /^\s+$/.test(token);
            if (isWhitespace) return <span key={i}>{token}</span>;
            return (
              <span key={i} className={diffResult.original.kept.has(i) ? "promptly-diff-kept-original" : "promptly-diff-removed"}>
                {token}
              </span>
            );
          })}
        </div>
      </div>
      <div className="promptly-diff-col optimized">
        <div className="col-header">Optimized</div>
        <div>
          {diffResult.optimized.tokens.map((token, i) => {
            const isWhitespace = /^\s+$/.test(token);
            if (isWhitespace) return <span key={i}>{token}</span>;
            const isAdded = !diffResult.optimized.kept.has(i);
            return (
              <span 
                key={i} 
                className={isAdded ? "promptly-diff-added" : "promptly-diff-kept-optimized"}
                onClick={() => isAdded && onCherryPick && onCherryPick(token)}
                style={isAdded && onCherryPick ? { cursor: 'pointer' } : {}}
                title={isAdded && onCherryPick ? 'Click to add to original' : undefined}
              >
                {token}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};
