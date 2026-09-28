import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/**
 * Единая дизайн-система v2: пресет PrimeNG + Tailwind-утилиты из `tailwindcss-primeui`
 * (`bg-primary-700`, `text-surface-500`, …). Основной цвет — `#0F4C81` из v1.
 */
export const AppPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#eef5fb',
      100: '#d6e6f4',
      200: '#adcce9',
      300: '#7eacd9',
      400: '#4d88c4',
      500: '#2a6aa9',
      600: '#1a5a95',
      700: '#0f4c81',
      800: '#0c3f6c',
      900: '#0a3358',
      950: '#06223b',
    },
    colorScheme: {
      light: {
        primary: {
          color: '{primary.700}',
          contrastColor: '#ffffff',
          hoverColor: '{primary.800}',
          activeColor: '{primary.900}',
        },
        highlight: {
          background: '{primary.50}',
          focusBackground: '{primary.100}',
          color: '{primary.800}',
          focusColor: '{primary.900}',
        },
      },
    },
  },
});
