import React, { useEffect, useState, useRef } from "react";

interface FloatingButtonProps {
  loading: boolean;
  active: boolean;
  compact?: boolean;
  promptState?: "idle" | "vague" | "ready";
  onClick: () => void;
  onDoubleClick: () => void;
  success?: boolean;
}

export const FloatingButton: React.FC<FloatingButtonProps> = ({ 
  loading, 
  active, 
  compact, 
  promptState = "idle", 
  onClick, 
  onDoubleClick, 
  success 
}) => {
  const [showSuccessRing, setShowSuccessRing] = useState(false);
  const clickTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (success) {
      setShowSuccessRing(true);
      const timer = setTimeout(() => setShowSuccessRing(false), 800);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current !== null) {
        window.clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  const handleClicks = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (clickTimeoutRef.current !== null) {
      // Double click detected!
      window.clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      onDoubleClick();
    } else {
      // Start standard single click timer window (250ms)
      clickTimeoutRef.current = window.setTimeout(() => {
        clickTimeoutRef.current = null;
        onClick();
      }, 250);
    }
  };

  const stateClass = promptState === "vague" ? "pulse-vague" : promptState === "ready" ? "glow-ready" : "";
  const imageUrl = chrome.runtime.getURL("public/promptly-orb.png");

  return (
    <button
      type="button"
      aria-label="Optimize prompt with Promptly"
      title="Single-click to open panel | Double-click to Auto-Optimize"
      onClick={handleClicks}
      onMouseDown={(e) => e.preventDefault()}
      className={`promptly-orb ${compact ? 'compact' : ''} ${loading ? "promptly-loading" : ""} ${active ? "promptly-orb-active" : ""} ${!active && stateClass ? stateClass : ""}`}
      style={{
        padding: 0,
        border: "none",
        background: "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "visible",
        boxShadow: "none"
      }}
    >
      <div className="promptly-loading-ring active" />
      <img
        src={imageUrl}
        alt="Promptly Orb"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: "50%",
          transform: active ? "scale(0.95)" : "scale(1)",
          transition: "transform 0.2s ease",
          zIndex: 2
        }}
      />
      {showSuccessRing && <div className="promptly-success-ring" />}
    </button>
  );
};
