export const supportedLocales = [
  { code: 'pt-BR', label: 'Português (Brasil)' },
  { code: 'en-US', label: 'English (United States)' },
  { code: 'es-419', label: 'Español (Latinoamérica)' },
  { code: 'fr-FR', label: 'Français' },
  { code: 'de-DE', label: 'Deutsch' },
  { code: 'it-IT', label: 'Italiano' },
  { code: 'pl-PL', label: 'Polski' },
  { code: 'tr-TR', label: 'Türkçe' },
  { code: 'ru-RU', label: 'Русский' },
  { code: 'ja-JP', label: '日本語' },
  { code: 'ko-KR', label: '한국어' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
] as const;

export const supportedCurrencyCodes = [
  'BRL', 'USD', 'EUR', 'GBP', 'CAD', 'MXN', 'ARS', 'CLP', 'TRY', 'JPY', 'KRW', 'CNY', 'AUD',
] as const;

export const communityRegions = [
  { code: 'south-america', label: 'South America' },
  { code: 'north-america', label: 'North America' },
  { code: 'europe', label: 'Europe' },
  { code: 'middle-east', label: 'Middle East' },
  { code: 'africa', label: 'Africa' },
  { code: 'asia', label: 'Asia' },
  { code: 'oceania', label: 'Oceania' },
] as const;

export const matchRegions = [
  { code: 'sao-paulo', label: 'São Paulo', communityRegionCode: 'south-america' },
  { code: 'virginia', label: 'Virginia', communityRegionCode: 'north-america' },
  { code: 'frankfurt', label: 'Frankfurt', communityRegionCode: 'europe' },
  { code: 'london', label: 'London', communityRegionCode: 'europe' },
  { code: 'singapore', label: 'Singapore', communityRegionCode: 'asia' },
  { code: 'sydney', label: 'Sydney', communityRegionCode: 'oceania' },
] as const;

export const localeCodes = supportedLocales.map(locale => locale.code) as [string, ...string[]];
export const communityRegionCodes = communityRegions.map(region => region.code) as [string, ...string[]];

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
