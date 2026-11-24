import { create } from 'zustand';

interface RateLimitState {
  retryUntilMs: number | null;
  triggerRateLimit: (retryAfterSec?: number) => void;
  clearRateLimit: () => void;
}

export const useRateLimitStore = create<RateLimitState>((set) => ({
  retryUntilMs: null,
  triggerRateLimit: (retryAfterSec = 30) =>
    set({ retryUntilMs: Date.now() + Math.max(5, retryAfterSec) * 1000 }),
  clearRateLimit: () => set({ retryUntilMs: null }),
}));
