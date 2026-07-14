/// <reference types="vite/client" />

interface ClutchGlobalPreferences {
  preferredLocale: string;
  timeZone: string;
  currencyCode: string;
  regionCode: string;
}

interface Window {
  ClutchGlobal?: {
    ready: Promise<unknown>;
    getPreferences(): ClutchGlobalPreferences;
    formatCurrency(amountMinor: number, currencyCode?: string): string;
    formatNumber(value: number, options?: Intl.NumberFormatOptions): string;
    formatDate(value: string | number | Date, options?: Intl.DateTimeFormatOptions): string;
  };
}
