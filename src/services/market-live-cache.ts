export type CachedValue<T> = {
  expiresAt: number;
  payload: T;
};

let marketLiveCache: CachedValue<unknown> | null = null;

export const getMarketLiveCache = <T>(): CachedValue<T> | null => {
  return marketLiveCache as CachedValue<T> | null;
};

export const setMarketLiveCache = <T>(value: CachedValue<T>) => {
  marketLiveCache = value as CachedValue<unknown>;
};

export const clearMarketLiveCache = () => {
  marketLiveCache = null;
};
