export const bauhausTokens = {
  colors: {
    background: '#F0F0F0',
    foreground: '#121212',
    red: '#D02020',
    blue: '#1040C0',
    yellow: '#F0C020',
    white: '#FFFFFF',
    muted: '#E0E0E0',
  },
  border: {
    width: '4px',
    widthMobile: '2px',
    color: '#121212',
  },
  shadow: {
    small: '4px 4px 0 0 #121212',
    medium: '6px 6px 0 0 #121212',
    large: '8px 8px 0 0 #121212',
  },
  radius: {
    none: '0',
    full: '9999px',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px',
  },
} as const

export type BauhausTone = 'red' | 'blue' | 'yellow' | 'white' | 'black'
