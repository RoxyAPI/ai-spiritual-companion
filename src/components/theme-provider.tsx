'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps } from 'react';

/**
 * next-themes, never a hand rolled provider. A custom one reads its stored value in an effect,
 * which means the first paint is always the light theme and a dark mode visitor gets a white flash.
 */
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
