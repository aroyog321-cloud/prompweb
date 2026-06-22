export const motionTokens = {
  duration: {
    fast: 0.2,
    normal: 0.35,
    slow: 0.5,
  },
  ease: {
    // Ported from the extension's css variables: --ease-out-expo
    expo: [0.16, 1, 0.3, 1],
    // Ported from the extension's css variables: --ease-out-back
    back: [0.34, 1.56, 0.64, 1],
  },
};

export const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
};
