import React from "react";
import { RewriteLevel } from '@promptly/types';

interface IntensityBarsProps {
  level: RewriteLevel;
  onChange: (level: RewriteLevel) => void;
}

const LEVELS = ["light", "medium", "aggressive", "expert"] as const;

export const IntensityBars: React.FC<IntensityBarsProps> = ({ level, onChange }) => {
  const currentLevelIndex = LEVELS.indexOf(level) !== -1 ? LEVELS.indexOf(level) + 1 : 2;

  return (
    <div className="promptly-intensity" onClick={() => { 
      const nextLevelIndex = currentLevelIndex === 4 ? 1 : currentLevelIndex + 1;
      onChange(LEVELS[nextLevelIndex - 1]);
    }} title="Rewrite Intensity">
      {[1, 2, 3, 4].map(i => <span key={i} className={`bar ${i <= currentLevelIndex ? 'on' : ''}`} />)}
      <span className="label">{LEVELS[currentLevelIndex - 1].charAt(0).toUpperCase() + LEVELS[currentLevelIndex - 1].slice(1)}</span>
    </div>
  );
};
