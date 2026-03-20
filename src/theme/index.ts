import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

const theme = extendTheme({
  config,
  fonts: {
    heading: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
    body: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
  },
  fontSizes: {
    xs: '0.8rem',
    sm: '0.9rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },
  colors: {
    brand: {
      50: '#e6f7f7',
      100: '#b3e8e8',
      200: '#80d9d9',
      300: '#4dcaca',
      400: '#26bfbf',
      500: '#0D9488',  // primary teal
      600: '#0b8278',
      700: '#096b63',
      800: '#07544e',
      900: '#043d39',
    },
    gray: {
      50: '#F9FAFB',
      100: '#F3F4F6',
      200: '#E5E7EB',
      300: '#D1D5DB',
      400: '#9CA3AF',
      500: '#6B7280',
      600: '#4B5563',
      700: '#374151',
      800: '#1F2937',
      900: '#111827',
    },
  },
  styles: {
    global: {
      body: {
        bg: 'gray.50',
        color: 'gray.800',
        fontSize: 'md',
        lineHeight: 'tall',
      },
    },
  },
  components: {
    Button: {
      defaultProps: {
        colorScheme: 'brand',
      },
      baseStyle: {
        fontWeight: '600',
        borderRadius: 'lg',
      },
      sizes: {
        md: {
          h: '44px',
          minW: '44px',
          fontSize: 'md',
          px: '6',
        },
        lg: {
          h: '52px',
          minW: '52px',
          fontSize: 'lg',
          px: '8',
        },
      },
    },
    Input: {
      defaultProps: {
        size: 'md',
      },
      sizes: {
        md: {
          field: {
            h: '44px',
            fontSize: 'md',
            borderRadius: 'lg',
          },
        },
      },
    },
    Select: {
      defaultProps: {
        size: 'md',
      },
      sizes: {
        md: {
          field: {
            h: '44px',
            fontSize: 'md',
            borderRadius: 'lg',
          },
        },
      },
    },
    Table: {
      variants: {
        simple: {
          th: {
            fontSize: 'sm',
            fontWeight: '700',
            textTransform: 'none',
            letterSpacing: 'normal',
            color: 'gray.600',
            borderColor: 'gray.200',
          },
          td: {
            fontSize: 'md',
            borderColor: 'gray.100',
            py: '3',
          },
        },
      },
    },
    Card: {
      baseStyle: {
        container: {
          bg: 'white',
          borderRadius: 'xl',
          boxShadow: 'sm',
          border: '1px solid',
          borderColor: 'gray.100',
        },
      },
    },
    Badge: {
      baseStyle: {
        borderRadius: 'full',
        px: '3',
        py: '1',
        fontSize: 'xs',
        fontWeight: '600',
      },
    },
  },
});

export default theme;
