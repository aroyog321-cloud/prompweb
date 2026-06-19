import React, { useMemo } from 'react';

interface StreamingTextProps {
  text: string;
  isStreaming: boolean;
  className?: string;
}

export const StreamingText: React.FC<StreamingTextProps> = ({ text, isStreaming, className = "" }) => {
  const tokens = useMemo(() => {
    return text.match(/\S+|\s+/g) || [];
  }, [text]);

  return (
    <div className={`promptly-stream ${className}`}>
      {tokens.map((token, i) => {
        const isWhitespace = /^\s+$/.test(token);
        if (isWhitespace) {
          return <span key={`${i}-${token}`} className="whitespace">{token}</span>;
        }
        
        return (
          <span 
            key={`${i}-${token}`}
            className="promptly-text-reveal" 
            style={isStreaming ? { animationDelay: `${Math.min(i * 18, 500)}ms` } : { animationDelay: '0ms' }}
          >
            {token}
          </span>
        );
      })}
    </div>
  );
};
