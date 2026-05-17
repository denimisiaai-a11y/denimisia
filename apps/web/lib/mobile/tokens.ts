export const TOUCH = {
  min: 44,
  default: 48,
  comfortable: 56,
} as const;

export const MOBILE_BREAKPOINT_PX = 768;

export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`;
