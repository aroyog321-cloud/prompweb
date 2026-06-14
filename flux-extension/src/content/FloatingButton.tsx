import React from "react";

interface FloatingButtonProps {
  loading: boolean;
  active: boolean;
  compact?: boolean;
  onClick: () => void;
}

export const FloatingButton: React.FC<FloatingButtonProps> = ({ loading, active, onClick }) => {
  return (
    <button
      type="button"
      aria-label="Optimize prompt with Flux"
      title="Optimize prompt (Ctrl+Shift+P)"
      onClick={onClick}
      className={`flux-orb ${loading ? "flux-loading" : ""} ${active ? "flux-orb-active" : ""}`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"
          fill="url(#flux-gradient)"
          stroke="url(#flux-gradient)"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="flux-gradient" x1="0" y1="0" x2="24" y2="24">
            <stop offset="0%" stopColor="#4FE6E0" />
            <stop offset="50%" stopColor="#8B6CFF" />
            <stop offset="100%" stopColor="#FF5FB8" />
          </linearGradient>
        </defs>
      </svg>
    </button>
  );
};
