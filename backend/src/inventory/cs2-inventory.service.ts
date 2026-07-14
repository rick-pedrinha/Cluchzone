import { AppError } from '../errors/app-error.js';

const STEAM_USER_ID = /^7656119\d{10}$/;
const INVENTORY_LIMIT = 2000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const MARKET_PRICE_CACHE_TTL_MS = 30 * 60 * 1000;
const MARKET_PRICE_LOOKUP_LIMIT = 120;
const MARKET_PRICE_CONCURRENCY = 4;
const STEAM_IMAGE_TOKEN = /^[A-Za-z0-9_-]{1,500}$/;
export const SHOWCASE_ITEM_COUNT = 4;
export const MIN_SHOWCASE_PRICE_MINOR = 5_000;

export const STEAM_INVENTORY_GAMES = {
  cs2: { key: 'cs2', name: 'Counter-Strike 2', shortName: 'CS2', appId: 730, contextId: 2 },
  pubg: { key: 'pubg', name: 'PUBG: Battlegrounds', shortName: 'PUBG', appId: 578080, contextId: 2 },
} as const;

export type SteamInventoryGameKey = keyof typeof STEAM_INVENTORY_GAMES;

export type Cs2InventoryCategory = 'weapon' | 'knife' | 'glove' | 'agent' | 'sticker' | 'graffiti' | 'container' | 'other';

export type Cs2InventoryItem = {
  assetId: string;
  classId: string;
  name: string;
  marketHashName: string | null;
  type: string | null;
  category: Cs2InventoryCategory;
  imageUrl: string | null;
  rarity: string | null;
  rarityColor: string | null;
  exterior: string | null;
  tradable: boolean;
  marketable: boolean;
  quantity: number;
};

export type SteamMarketPrice = {
  amountMinor: number;
  currency: 'BRL';
  formatted: string;
};

export type SteamInventoryHighlight = Cs2InventoryItem & {
  marketPrice: SteamMarketPrice;
};

export type Cs2Inventory = {
  total: number;
  loaded: number;
  truncated: boolean;
  items: Cs2InventoryItem[];
  synchronizedAt: Date;
};

export interface Cs2InventoryService {
  getPublicInventory(steamId64: string): Promise<Cs2Inventory>;
}

export interface SteamGameInventoryService extends Cs2InventoryService {
  getPublicGameInventory(steamId64: string, game: SteamInventoryGameKey): Promise<Cs2Inventory>;
  getPublicGameHighlights(items: Cs2InventoryItem[], game: SteamInventoryGameKey): Promise<SteamInventoryHighlight[]>;
}

const HIGHLIGHT_CATEGORY_SCORE: Record<Cs2InventoryCategory, number> = {
  knife: 10_000,
  glove: 9_000,
  agent: 4_000,
  weapon: 3_000,
  sticker: 2_000,
  graffiti: 0,
  container: 1_000,
  other: 0,
};

const HIGHLIGHT_RARITY_SCORE: Record<string, number> = {
  '#e4ae39': 800,
  '#eb4b4b': 700,
  '#d32ce6': 600,
  '#8847ff': 500,
  '#4b69ff': 400,
  '#5e98d9': 300,
  '#b0c3d9': 200,
};

function highlightScore(item: Cs2InventoryItem): number {
  const rarity = HIGHLIGHT_RARITY_SCORE[item.rarityColor?.toLowerCase() ?? ''] ?? (item.rarity ? 100 : 0);
  return HIGHLIGHT_CATEGORY_SCORE[item.category]
    + rarity
    + (item.marketable ? 30 : 0)
    + (item.tradable ? 20 : 0);
}

export function selectInventoryHighlights(items: Cs2InventoryItem[], maximum = 4): Cs2InventoryItem[] {
  const limit = Math.max(1, Math.min(12, Math.trunc(maximum)));
  const uniqueItems = new Map<string, Cs2InventoryItem>();
  items.forEach(item => {
    const key = `${item.classId}:${item.name.toLocaleLowerCase('pt-BR')}`;
    const current = uniqueItems.get(key);
    if (!current || highlightScore(item) > highlightScore(current)) uniqueItems.set(key, item);
  });
  return [...uniqueItems.values()]
    .sort((first, second) => highlightScore(second) - highlightScore(first)
      || first.name.localeCompare(second.name, 'pt-BR'))
    .slice(0, limit);
}

type CacheEntry = { expiresAt: number; inventory: Cs2Inventory };
type PriceCacheEntry = { expiresAt: number; price: SteamMarketPrice | null };
type SteamTag = { category?: unknown; internal_name?: unknown; localized_tag_name?: unknown; color?: unknown };
type SteamAsset = { assetid?: unknown; classid?: unknown; instanceid?: unknown; amount?: unknown };
type SteamDescription = {
  classid?: unknown;
  instanceid?: unknown;
  name?: unknown;
  market_name?: unknown;
  market_hash_name?: unknown;
  type?: unknown;
  icon_url?: unknown;
  tradable?: unknown;
  marketable?: unknown;
  name_color?: unknown;
  tags?: unknown;
};

function text(value: unknown, maximum = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function positiveInteger(value: unknown, fallback = 1): number {
  const parsed = typeof value === 'string' || typeof value === 'number' ? Number(value) : Number.NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function validColor(value: unknown): string | null {
  const color = text(value, 6);
  return /^[A-Fa-f0-9]{6}$/.test(color) ? `#${color.toLowerCase()}` : null;
}

function normalizedTags(value: unknown): Array<{ category: string; internalName: string; label: string; color: string | null }> {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 40).flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const tag = item as SteamTag;
    const category = text(tag.category, 60);
    const internalName = text(tag.internal_name, 100);
    const label = text(tag.localized_tag_name, 100);
    return category && (internalName || label)
      ? [{ category, internalName, label: label || internalName, color: validColor(tag.color) }]
      : [];
  });
}

export function classifyCs2Item(name: string, type: string, tags: ReturnType<typeof normalizedTags>): Cs2InventoryCategory {
  const values = [name, type, ...tags.flatMap(tag => [tag.category, tag.internalName, tag.label])].join(' ').toLowerCase();
  if (/graffiti|grafite|spray/.test(values)) return 'graffiti';
  if (/knife|bayonet|karambit|daggers|faca/.test(values)) return 'knife';
  if (/glove|luvas?/.test(values)) return 'glove';
  if (/customplayer|agent|agente/.test(values)) return 'agent';
  if (/sticker|patch|adesivo/.test(values)) return 'sticker';
  if (/container|weaponcase|case|capsule|package|key|caixa|cápsula/.test(values)) return 'container';
  if (tags.some(tag => tag.category === 'Weapon') || /rifle|pistol|smg|shotgun|machinegun|sniper|weapon|arma/.test(values)) return 'weapon';
  return 'other';
}

export function mapPublicSteamInventory(payload: unknown, fallbackItemName = 'Item Steam'): Cs2Inventory {
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const assets = Array.isArray(record['assets']) ? record['assets'] as SteamAsset[] : [];
  const descriptions = Array.isArray(record['descriptions']) ? record['descriptions'] as SteamDescription[] : [];
  const descriptionByKey = new Map(descriptions.map(description => [
    `${text(description.classid, 30)}_${text(description.instanceid, 30) || '0'}`,
    description,
  ]));

  const items = assets.slice(0, INVENTORY_LIMIT).flatMap(asset => {
    const assetId = text(asset.assetid, 30);
    const classId = text(asset.classid, 30);
    const instanceId = text(asset.instanceid, 30) || '0';
    const description = descriptionByKey.get(`${classId}_${instanceId}`);
    if (!assetId || !classId || !description) return [];
    const tags = normalizedTags(description.tags);
    const marketHashName = text(description.market_hash_name, 200);
    const name = text(description.market_name, 200) || text(description.name, 200) || marketHashName || fallbackItemName;
    const type = text(description.type, 160);
    const rarityTag = tags.find(tag => tag.category === 'Rarity');
    const exteriorTag = tags.find(tag => tag.category === 'Exterior');
    const iconToken = text(description.icon_url, 500);
    return [{
      assetId,
      classId,
      name,
      marketHashName: marketHashName || null,
      type: type || null,
      category: classifyCs2Item(name, type, tags),
      imageUrl: STEAM_IMAGE_TOKEN.test(iconToken)
        ? `https://community.fastly.steamstatic.com/economy/image/${iconToken}/360fx360f`
        : null,
      rarity: rarityTag?.label ?? null,
      rarityColor: rarityTag?.color ?? validColor(description.name_color),
      exterior: exteriorTag?.label ?? null,
      tradable: Number(description.tradable) === 1,
      marketable: Number(description.marketable) === 1,
      quantity: positiveInteger(asset.amount),
    } satisfies Cs2InventoryItem];
  });
  const reportedTotal = positiveInteger(record['total_inventory_count'], items.length);
  const total = Math.max(reportedTotal, items.length);
  return {
    total,
    loaded: items.length,
    truncated: total > items.length,
    items,
    synchronizedAt: new Date(),
  };
}

export function mapPublicCs2Inventory(payload: unknown): Cs2Inventory {
  return mapPublicSteamInventory(payload, 'Item CS2');
}

export class SteamCommunityCs2InventoryService implements SteamGameInventoryService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly pending = new Map<string, Promise<Cs2Inventory>>();
  private readonly priceCache = new Map<string, PriceCacheEntry>();
  private readonly pricePending = new Map<string, Promise<SteamMarketPrice | null>>();

  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async getPublicInventory(steamId64: string): Promise<Cs2Inventory> {
    return this.getPublicGameInventory(steamId64, 'cs2');
  }

  async getPublicGameInventory(steamId64: string, game: SteamInventoryGameKey): Promise<Cs2Inventory> {
    if (!STEAM_USER_ID.test(steamId64)) {
      throw new AppError(400, 'INVALID_STEAM_ID', 'The player has an invalid Steam identity.');
    }
    const gameDefinition = STEAM_INVENTORY_GAMES[game];
    const cacheKey = `${game}:${steamId64}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.inventory;
    const activeRequest = this.pending.get(cacheKey);
    if (activeRequest) return activeRequest;
    const request = this.fetchInventory(steamId64, gameDefinition);
    this.pending.set(cacheKey, request);
    try {
      const inventory = await request;
      this.cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, inventory });
      return inventory;
    } finally {
      this.pending.delete(cacheKey);
    }
  }

  async getPublicGameHighlights(items: Cs2InventoryItem[], game: SteamInventoryGameKey): Promise<SteamInventoryHighlight[]> {
    const unique = new Map<string, Cs2InventoryItem>();
    items.forEach(item => {
      if (!item.marketable || !item.marketHashName || item.category === 'graffiti' || item.category === 'sticker') return;
      const key = item.marketHashName.toLocaleLowerCase('en-US');
      const current = unique.get(key);
      if (!current || highlightScore(item) > highlightScore(current)) unique.set(key, item);
    });
    const candidates = [...unique.values()]
      .sort((first, second) => highlightScore(second) - highlightScore(first))
      .slice(0, MARKET_PRICE_LOOKUP_LIMIT);
    const priced = await this.priceCandidates(candidates, STEAM_INVENTORY_GAMES[game].appId);
    const valuable = priced
      .filter((item): item is SteamInventoryHighlight => item !== null && item.marketPrice.amountMinor >= MIN_SHOWCASE_PRICE_MINOR)
      .sort((first, second) => second.marketPrice.amountMinor - first.marketPrice.amountMinor
        || highlightScore(second) - highlightScore(first)
        || first.name.localeCompare(second.name, 'pt-BR'))
      .slice(0, SHOWCASE_ITEM_COUNT);
    return valuable.length === SHOWCASE_ITEM_COUNT ? valuable : [];
  }

  private async priceCandidates(items: Cs2InventoryItem[], appId: number): Promise<Array<SteamInventoryHighlight | null>> {
    const results = new Array<SteamInventoryHighlight | null>(items.length).fill(null);
    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        const item = items[index];
        if (!item?.marketHashName) continue;
        const marketPrice = await this.getMarketPrice(appId, item.marketHashName);
        if (marketPrice) results[index] = { ...item, marketPrice };
      }
    };
    await Promise.all(Array.from({ length: Math.min(MARKET_PRICE_CONCURRENCY, items.length) }, worker));
    return results;
  }

  private async getMarketPrice(appId: number, marketHashName: string): Promise<SteamMarketPrice | null> {
    const cacheKey = `${appId}:${marketHashName}`;
    const cached = this.priceCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.price;
    const activeRequest = this.pricePending.get(cacheKey);
    if (activeRequest) return activeRequest;
    const request = this.fetchMarketPrice(appId, marketHashName);
    this.pricePending.set(cacheKey, request);
    try {
      const price = await request;
      this.priceCache.set(cacheKey, { expiresAt: Date.now() + MARKET_PRICE_CACHE_TTL_MS, price });
      return price;
    } finally {
      this.pricePending.delete(cacheKey);
    }
  }

  private async fetchMarketPrice(appId: number, marketHashName: string): Promise<SteamMarketPrice | null> {
    const url = new URL('https://steamcommunity.com/market/priceoverview/');
    url.searchParams.set('appid', String(appId));
    url.searchParams.set('currency', '7');
    url.searchParams.set('market_hash_name', marketHashName);
    try {
      const response = await this.fetcher(url, {
        headers: { accept: 'application/json', 'accept-language': 'pt-BR,pt;q=0.9' },
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) return null;
      const payload = await response.json() as { success?: unknown; lowest_price?: unknown; median_price?: unknown };
      if (payload.success !== true) return null;
      const amountMinor = parseSteamBrlPrice(payload.lowest_price) ?? parseSteamBrlPrice(payload.median_price);
      return amountMinor === null ? null : {
        amountMinor,
        currency: 'BRL',
        formatted: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amountMinor / 100),
      };
    } catch {
      return null;
    }
  }

  private async fetchInventory(
    steamId64: string,
    game: typeof STEAM_INVENTORY_GAMES[SteamInventoryGameKey],
  ): Promise<Cs2Inventory> {
    const url = new URL(`https://steamcommunity.com/inventory/${steamId64}/${game.appId}/${game.contextId}`);
    url.searchParams.set('l', 'brazilian');
    url.searchParams.set('count', String(INVENTORY_LIMIT));
    let response: Response;
    try {
      response = await this.fetcher(url, { headers: { accept: 'application/json' } });
    } catch {
      throw new AppError(502, 'STEAM_INVENTORY_UNAVAILABLE', 'Steam inventory is temporarily unavailable.');
    }
    if (response.status === 401 || response.status === 403) {
      throw new AppError(403, 'STEAM_INVENTORY_PRIVATE', 'This Steam inventory is not public.');
    }
    if (response.status === 429) {
      throw new AppError(503, 'STEAM_INVENTORY_RATE_LIMITED', 'Steam inventory is temporarily busy.');
    }
    if (!response.ok) throw new AppError(502, 'STEAM_INVENTORY_UNAVAILABLE', 'Steam inventory is temporarily unavailable.');
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new AppError(502, 'INVALID_STEAM_RESPONSE', 'Steam returned an invalid inventory response.');
    }
    const success = (payload as { success?: unknown } | null)?.success;
    if (success !== 1 && success !== true) {
      throw new AppError(403, 'STEAM_INVENTORY_PRIVATE', 'This Steam inventory is not public.');
    }
    return mapPublicSteamInventory(payload, `Item ${game.shortName}`);
  }
}

export function parseSteamBrlPrice(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}
