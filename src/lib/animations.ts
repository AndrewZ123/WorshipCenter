// Framer Motion animation variants for consistent animations across the app
// All animations are kept under 250ms for subtle polish

export const listItemVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export const listItemTransition = {
  duration: 0.2,
};

// Staggered children animation
export const containerVariants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

// Card hover lift effect
export const cardHoverVariants = {
  rest: { 
    y: 0, 
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' 
  },
  hover: { 
    y: -2, 
    boxShadow: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
    transition: { duration: 0.15 }
  },
};

// Modal entrance animation
export const modalVariants = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.97 },
};

export const modalTransition = {
  duration: 0.2,
};

// Fade in animation
export const fadeInVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const fadeInTransition = {
  duration: 0.15,
};

// Slide up animation
export const slideUpVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 16 },
};

export const slideUpTransition = {
  duration: 0.2,
};

// Scale animation for buttons
export const buttonTapVariants = {
  tap: { scale: 0.98 },
};

export const buttonTransition = {
  duration: 0.1,
};

// Skeleton pulse animation (CSS-based, but defined here for reference)
export const skeletonAnimation = {
  animate: 'pulse',
  transition: {
    repeat: Infinity,
    duration: 1.5,
    ease: 'easeInOut',
  },
};