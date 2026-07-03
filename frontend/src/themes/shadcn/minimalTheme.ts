import { createTheme, type MantineThemeOverride } from '@mantine/core';
import { shadcnColors } from './colors.ts';
import { shadcnComponentColorOverrides } from './componentColorOverrides.ts';

export const shadcnMinimalTheme: MantineThemeOverride = createTheme({
  colors: shadcnColors,
  primaryColor: 'primary',
  primaryShade: { light: 8, dark: 0 },
  autoContrast: true,
  luminanceThreshold: 0.3,
  other: {
    style: 'shadcn-minimal',
  },
  components: shadcnComponentColorOverrides,
});
