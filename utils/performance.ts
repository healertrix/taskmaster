import { useMemo, useCallback } from 'react';

// Performance optimization utilities

/**
 * Memoized color display utility
 * Caches color display calculations to avoid repeated computations
 */
export const createColorDisplay = (color: string) => {
  if (color.startsWith('#') || color.startsWith('rgb')) {
    return {
      isCustom: true,
      style: { backgroundColor: color },
      className: '',
    };
  }
  return {
    isCustom: false,
    style: {},
    className: color,
  };
};

/**
 * Memoized date formatter
 * Creates a reusable date formatter instance
 */
export const createDateFormatter = () => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (dateString: string) => formatter.format(new Date(dateString));
};

/**
 * Hook for memoized color display
 */
export const useColorDisplay = () => {
  return useMemo(() => createColorDisplay, []);
};

/**
 * Hook for memoized date formatting
 */
export const useDateFormatter = () => {
  return useMemo(() => createDateFormatter(), []);
};

/**
 * Debounce utility for performance optimization
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttle utility for performance optimization
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Memoized sorting utility for boards
 */
export const useSortedBoards = (boards: any[]) => {
  return useMemo(() => {
    return [...boards].sort((a, b) => {
      // Starred boards first
      if (a.starred && !b.starred) return -1;
      if (!a.starred && b.starred) return 1;

      // Then by last activity
      return (
        new Date(b.last_activity_at).getTime() -
        new Date(a.last_activity_at).getTime()
      );
    });
  }, [boards]);
};

/**
 * Intersection Observer hook for lazy loading
 */
export const useIntersectionObserver = (
  callback: (isIntersecting: boolean) => void,
  options: IntersectionObserverInit = {}
) => {
  return useCallback(
    (node: HTMLElement | null) => {
      if (node) {
        const observer = new IntersectionObserver(
          ([entry]) => callback(entry.isIntersecting),
          {
            rootMargin: '100px',
            threshold: 0.1,
            ...options,
          }
        );

        observer.observe(node);

        return () => observer.unobserve(node);
      }
    },
    [callback, options]
  );
};

/**
 * Virtual scrolling utilities
 */
export const calculateVisibleRange = (
  scrollTop: number,
  containerHeight: number,
  itemHeight: number,
  totalItems: number,
  overscan: number = 5
) => {
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    totalItems - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  return { startIndex, endIndex };
};

/**
 * Performance monitoring utilities
 */
export const performanceMonitor = {
  start: (label: string) => {
    if (typeof performance !== 'undefined') {
      performance.mark(`${label}-start`);
    }
  },

  end: (label: string) => {
    if (typeof performance !== 'undefined') {
      performance.mark(`${label}-end`);
      performance.measure(label, `${label}-start`, `${label}-end`);

      const measure = performance.getEntriesByName(label)[0];
      console.log(`${label}: ${measure.duration.toFixed(2)}ms`);

      // Clean up
      performance.clearMarks(`${label}-start`);
      performance.clearMarks(`${label}-end`);
      performance.clearMeasures(label);
    }
  },

  measure: (label: string, fn: () => void) => {
    performanceMonitor.start(label);
    fn();
    performanceMonitor.end(label);
  },
};

/**
 * Memory management utilities
 */
export const memoryManager = {
  // Clear unused cache entries
  cleanupCache: (cache: Map<string, any>, maxAge: number = 5 * 60 * 1000) => {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
      if (now - value.timestamp > maxAge) {
        cache.delete(key);
      }
    }
  },

  // Limit cache size
  limitCacheSize: (cache: Map<string, any>, maxSize: number) => {
    if (cache.size > maxSize) {
      const entries = Array.from(cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

      const toDelete = entries.slice(0, cache.size - maxSize);
      toDelete.forEach(([key]) => cache.delete(key));
    }
  },
};

/**
 * React optimization helpers
 */
export const reactOptimizations = {
  // Memoized callback that only changes when dependencies change
  stableCallback: <T extends (...args: any[]) => any>(
    callback: T,
    deps: any[]
  ): T => {
    return useCallback(callback, deps) as T;
  },

  // Memoized value that only recalculates when dependencies change
  stableValue: <T>(value: T, deps: any[]): T => {
    return useMemo(() => value, deps);
  },

  // Deep comparison for objects
  deepEqual: (a: any, b: any): boolean => {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;

    if (typeof a === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);

      if (keysA.length !== keysB.length) return false;

      return keysA.every((key) => deepEqual(a[key], b[key]));
    }

    return false;
  },
};

// Export the deepEqual function for use in other files
const { deepEqual } = reactOptimizations;
