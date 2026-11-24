import { logger } from './logger';

/**
 * Lightweight native PerformanceObserver Web Vitals reporter (LCP, CLS, INP/FCP).
 * Zero external bundle overhead; forwards metrics to structured observability boundary.
 */
export function initWebVitalsReporter(): void {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;

  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) {
        logger.debug('WebVital LCP', { valueMs: Math.round(last.startTime) });
      }
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
        if (!shift.hadRecentInput && typeof shift.value === 'number') {
          clsValue += shift.value;
        }
      }
      if (clsValue > 0) {
        logger.debug('WebVital CLS', { value: Math.round(clsValue * 1000) / 1000 });
      }
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });

    const fcpObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          logger.debug('WebVital FCP', { valueMs: Math.round(entry.startTime) });
        }
      }
    });
    fcpObserver.observe({ type: 'paint', buffered: true });
  } catch {
    // Gracefully skip unsupported observer types
  }
}
