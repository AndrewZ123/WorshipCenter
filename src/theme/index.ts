import { extendTheme, type ThemeConfig, type StyleFunctionProps } from '@chakra-ui/react';

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
      500: '#0D9488',
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
  semanticTokens: {
    colors: {
      'chakra-body-bg': { _light: 'gray.50', _dark: 'gray.900' },
      'chakra-body-text': { _light: 'gray.800', _dark: 'gray.100' },
    },
  },
  styles: {
    global: (props: StyleFunctionProps) => ({
      body: {
        bg: props.colorMode === 'dark' ? 'gray.900' : 'gray.50',
        color: props.colorMode === 'dark' ? 'gray.100' : 'gray.800',
        fontSize: 'md',
        lineHeight: 'tall',
      },
      '.chakra-ui-dark .text-improved-contrast': {
        color: '#cbd5e0 !important',
      },
      '.chakra-ui-light .text-improved-contrast': {
        color: '#4a5568 !important',
      },
    }),
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
      variants: {
        outline: (props: StyleFunctionProps) => ({
          borderColor: props.colorMode === 'dark' ? 'gray.600' : 'gray.200',
          _hover: {
            bg: props.colorMode === 'dark' ? 'whiteAlpha.100' : 'gray.50',
            borderColor: 'teal.300',
          },
        }),
        ghost: (props: StyleFunctionProps) => ({
          _hover: {
            bg: props.colorMode === 'dark' ? 'whiteAlpha.100' : 'gray.50',
          },
        }),
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
        simple: (props: StyleFunctionProps) => ({
          th: {
            fontSize: 'sm',
            fontWeight: '700',
            textTransform: 'none',
            letterSpacing: 'normal',
            color: props.colorMode === 'dark' ? 'gray.300' : 'gray.600',
            borderColor: props.colorMode === 'dark' ? 'gray.700' : 'gray.200',
          },
          td: {
            fontSize: 'md',
            borderColor: props.colorMode === 'dark' ? 'gray.700' : 'gray.100',
            color: props.colorMode === 'dark' ? 'gray.200' : 'gray.800',
            py: '3',
          },
        }),
      },
    },
    Card: {
      baseStyle: (props: StyleFunctionProps) => ({
        container: {
          bg: props.colorMode === 'dark' ? 'gray.800' : 'white',
          borderRadius: 'xl',
          boxShadow: props.colorMode === 'dark'
            ? '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)'
            : 'sm',
          border: '1px solid',
          borderColor: props.colorMode === 'dark' ? 'gray.700' : 'gray.100',
        },
      }),
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
    Menu: {
      baseStyle: (props: StyleFunctionProps) => ({
        list: {
          bg: props.colorMode === 'dark' ? 'gray.800' : 'white',
          borderColor: props.colorMode === 'dark' ? 'gray.700' : 'gray.200',
          boxShadow: props.colorMode === 'dark'
            ? '0 4px 12px rgba(0,0,0,0.4)'
            : 'lg',
        },
        item: {
          bg: props.colorMode === 'dark' ? 'gray.800' : 'white',
          _hover: {
            bg: props.colorMode === 'dark' ? 'gray.700' : 'gray.50',
          },
          _focus: {
            bg: props.colorMode === 'dark' ? 'gray.700' : 'gray.50',
          },
        },
        divider: {
          borderColor: props.colorMode === 'dark' ? 'gray.700' : 'gray.200',
        },
      }),
    },
    Modal: {
      baseStyle: (props: StyleFunctionProps) => ({
        dialog: {
          bg: props.colorMode === 'dark' ? 'gray.800' : 'white',
        },
        header: {
          borderBottomColor: props.colorMode === 'dark' ? 'gray.700' : 'gray.200',
        },
        closeButton: {
          _hover: {
            bg: props.colorMode === 'dark' ? 'gray.700' : 'gray.100',
          },
        },
      }),
    },
    Drawer: {
      baseStyle: (props: StyleFunctionProps) => ({
        dialog: {
          bg: props.colorMode === 'dark' ? 'gray.800' : 'white',
        },
      }),
    },
    Popover: {
      baseStyle: (props: StyleFunctionProps) => ({
        content: {
          bg: props.colorMode === 'dark' ? 'gray.800' : 'white',
          borderColor: props.colorMode === 'dark' ? 'gray.700' : 'gray.200',
          boxShadow: props.colorMode === 'dark'
            ? '0 4px 12px rgba(0,0,0,0.4)'
            : 'lg',
        },
        header: {
          borderBottomColor: props.colorMode === 'dark' ? 'gray.700' : 'gray.200',
        },
        closeButton: {
          _hover: {
            bg: props.colorMode === 'dark' ? 'gray.700' : 'gray.100',
          },
        },
      }),
    },
    Tabs: {
      variants: {
        line: (props: StyleFunctionProps) => ({
          tab: {
            _selected: {
              color: 'teal.500',
              borderColor: 'teal.500',
            },
            _hover: {
              bg: props.colorMode === 'dark' ? 'whiteAlpha.100' : 'gray.50',
            },
          },
          tablist: {
            borderBottomColor: props.colorMode === 'dark' ? 'gray.700' : 'gray.200',
          },
        }),
      },
    },
    Switch: {
      baseStyle: (props: StyleFunctionProps) => ({
        track: {
          bg: props.colorMode === 'dark' ? 'gray.600' : 'gray.300',
          _checked: {
            bg: 'teal.500',
          },
        },
      }),
    },
    Divider: {
      baseStyle: (props: StyleFunctionProps) => ({
        borderColor: props.colorMode === 'dark' ? 'gray.700' : 'gray.200',
      }),
    },
    Tag: {
      baseStyle: (props: StyleFunctionProps) => ({
        container: {
          bg: props.colorMode === 'dark' ? 'gray.700' : 'gray.100',
          color: props.colorMode === 'dark' ? 'gray.200' : 'gray.700',
        },
      }),
    },
    Tooltip: {
      baseStyle: {
        bg: 'gray.700',
        color: 'white',
        '--tooltip-bg': 'gray.700',
      },
    },
  },
});

export default theme;