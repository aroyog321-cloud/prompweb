import React from "react";
import { RewriteLevel } from '@promptly/types';

interface IntensityBarsProps {
  level: RewriteLevel;
  onChange: (level: RewriteLevel) => void;
}

const LEVELS = ["Basic", "Professional", "Staff+", "Research", "Production Audit"] as const;

export const IntensityBars: React.FC<IntensityBarsProps> = ({ level, onChange }) => {
  const currentLevelIndex = LEVELS.indexOf(level) !== -1 ? LEVELS.indexOf(level) + 1 : 2;

  return (
    <div className="promptly-intensity" onClick={() => { 
      const nextLevelIndex = currentLevelIndex === 5 ? 1 : currentLevelIndex + 1;
      onChange(LEVELS[nextLevelIndex - 1]);
    }} title="Prompt Level">
      {[1, 2, 3, 4, 5].map(i => <span key={i} className={`bar ${i <= currentLevelIndex ? 'on' : ''}`} />)}
      <span className="label">{LEVELS[currentLevelIndex - 1]}</span>
    </div>
  );
};
