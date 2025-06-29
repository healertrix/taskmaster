import { throttle, debounce } from './performance';

// Navigation throttling utilities
export class NavigationManager {
  private static instance: NavigationManager;
  private isNavigating = false;
  private navigationQueue: Array<() => void> = [];
  private lastNavigationTime = 0;
  private readonly NAVIGATION_DELAY = 300; // 300ms between navigations

  static getInstance(): NavigationManager {
    if (!NavigationManager.instance) {
      NavigationManager.instance = new NavigationManager();
    }
    return NavigationManager.instance;
  }

  // Throttled navigation function
  navigate = throttle((url: string, options?: { replace?: boolean }) => {
    if (this.isNavigating) {
      this.navigationQueue.push(() => this.performNavigation(url, options));
      return;
    }

    const now = Date.now();
    if (now - this.lastNavigationTime < this.NAVIGATION_DELAY) {
      this.navigationQueue.push(() => this.performNavigation(url, options));
      return;
    }

    this.performNavigation(url, options);
  }, 300);

  private performNavigation(url: string, options?: { replace?: boolean }) {
    this.isNavigating = true;
    this.lastNavigationTime = Date.now();

    try {
      if (options?.replace) {
        window.history.replaceState(null, '', url);
      } else {
        window.history.pushState(null, '', url);
      }

      // Trigger route change
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (error) {
      console.error('Navigation error:', error);
    } finally {
      this.isNavigating = false;

      // Process queued navigations
      if (this.navigationQueue.length > 0) {
        const nextNavigation = this.navigationQueue.shift();
        if (nextNavigation) {
          setTimeout(nextNavigation, this.NAVIGATION_DELAY);
        }
      }
    }
  }

  // Debounced state update for modals and overlays
  updateState = debounce((updater: () => void, delay: number = 100) => {
    updater();
  }, 100);

  // Safe modal open/close with throttling
  openModal = throttle((setter: (value: boolean) => void) => {
    setter(true);
  }, 200);

  closeModal = throttle((setter: (value: boolean) => void) => {
    setter(false);
  }, 200);

  // Prevent rapid clicks
  preventRapidClicks = (handler: () => void, delay: number = 300) => {
    return throttle(handler, delay);
  };
}

// Hook for safe navigation
export const useSafeNavigation = () => {
  const navManager = NavigationManager.getInstance();

  return {
    navigate: navManager.navigate,
    updateState: navManager.updateState,
    openModal: navManager.openModal,
    closeModal: navManager.closeModal,
    preventRapidClicks: navManager.preventRapidClicks,
  };
};

// Utility for preventing rapid state changes
export const createThrottledHandler = <T extends (...args: any[]) => any>(
  handler: T,
  delay: number = 300
): T => {
  return throttle(handler, delay) as T;
};

// Utility for preventing rapid clicks on buttons/links
export const createSafeClickHandler = (
  handler: () => void,
  delay: number = 300
) => {
  return throttle(handler, delay);
};

// Utility for modal state management
export const createModalHandlers = (setIsOpen: (value: boolean) => void) => {
  const navManager = NavigationManager.getInstance();

  return {
    open: () => navManager.openModal(setIsOpen),
    close: () => navManager.closeModal(setIsOpen),
  };
};
