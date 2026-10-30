import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/** Tema corporativo: Aura con primario azul petróleo y superficies neutras. */
export const TemaNexus = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#eef6fc',
      100: '#d6e9f7',
      200: '#b0d4ef',
      300: '#7db7e2',
      400: '#4893cf',
      500: '#2474b5',
      600: '#175b96',
      700: '#13497a',
      800: '#123e66',
      900: '#0b3d66',
      950: '#082a47',
    },
    colorScheme: {
      light: {
        surface: {
          0: '#ffffff',
          50: '#f7f9fb',
          100: '#eef2f6',
          200: '#e2e8ef',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        primary: {
          color: '{primary.600}',
          hoverColor: '{primary.700}',
          activeColor: '{primary.800}',
        },
      },
      dark: {
        surface: {
          0: '#ffffff',
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#111a2e',
          950: '#0b1120',
        },
        primary: {
          color: '{primary.300}',
          hoverColor: '{primary.200}',
          activeColor: '{primary.100}',
        },
      },
    },
  },
});
