'use client';

type BackHandlerCallback = () => void | boolean;

interface BackHandlerRecord {
  id: string;
  onBack: BackHandlerCallback;
  poppedByBrowser?: boolean;
}

class BackManager {
  private stack: BackHandlerRecord[] = [];
  private ignoreNextPopstate = 0;
  private isInitialized = false;
  private lastRootBackTime = 0;
  private isRootGuardActive = false;
  private exitToastCallback: (() => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  public init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;
    window.addEventListener('popstate', this.handlePopState);

    // If on a standalone sub-route and history is fresh, push sentinel so native back goes to /
    if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
      if (!window.history.state?.__appStandaloneGuard && !window.history.state?.__appModalId) {
        try {
          window.history.pushState({ __appStandaloneGuard: true }, '', window.location.href);
        } catch (e) {
          console.warn('[BackManager] Failed to push standalone guard:', e);
        }
      }
    }
  }

  public setExitToastCallback(cb: (() => void) | null) {
    this.exitToastCallback = cb;
  }

  private handlePopState = (_event: PopStateEvent) => {
    // If popstate was triggered programmatically by us calling history.back(), ignore it
    if (this.ignoreNextPopstate > 0) {
      this.ignoreNextPopstate--;
      return;
    }

    // 1. If we have active back handlers (modals, dialogs, subviews, QR scanner, etc.)
    if (this.stack.length > 0) {
      const top = this.stack.pop();
      if (top) {
        top.poppedByBrowser = true;
        try {
          top.onBack();
        } catch (err) {
          console.error('[BackManager] Error executing onBack handler:', err);
        }
      }
      return;
    }

    // 2. If stack is empty and root guard is active (on home dashboard)
    if (this.isRootGuardActive && window.location.pathname === '/') {
      const now = Date.now();
      if (now - this.lastRootBackTime < 2000) {
        // Double tap within 2 seconds: allow user to exit the app
        this.isRootGuardActive = false;
        window.history.back();
      } else {
        // First tap: show notification and re-push sentinel state
        this.lastRootBackTime = now;
        if (this.exitToastCallback) {
          this.exitToastCallback();
        }
        try {
          window.history.pushState({ __appRootGuard: true }, '', window.location.href);
        } catch (e) {
          console.warn('[BackManager] Failed to re-push root guard:', e);
        }
      }
      return;
    }

    // 3. If on a standalone page (e.g. /asistencias, /reportes, /agremiados), navigate to / instead of exiting
    if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
      window.location.href = '/';
    }
  };

  /**
   * Register an open modal or subview handler.
   */
  public register(id: string, onBack: BackHandlerCallback) {
    if (typeof window === 'undefined') return;
    this.init();

    // Push a dummy history state so that native back button will pop it and trigger popstate
    try {
      window.history.pushState({ __appModalId: id }, '', window.location.href);
    } catch (e) {
      console.warn('[BackManager] pushState failed:', e);
    }

    this.stack.push({ id, onBack, poppedByBrowser: false });
  }

  /**
   * Unregister when closed via UI or component unmount.
   */
  public unregister(id: string) {
    if (typeof window === 'undefined') return;

    const index = this.stack.findIndex(item => item.id === id);
    if (index === -1) {
      // Already popped by browser popstate
      return;
    }

    const item = this.stack[index];
    this.stack.splice(index, 1);

    // If not popped by browser, the dummy history entry is still in the browser history.
    // Call history.back() to remove it only if the current history state matches this modal.
    if (!item.poppedByBrowser) {
      if (window.history.state?.__appModalId === id) {
        this.ignoreNextPopstate++;
        window.history.back();
      }
    }
  }

  /**
   * Enable root back guard for home page.
   */
  public enableRootGuard() {
    if (typeof window === 'undefined') return;
    this.init();

    if (!this.isRootGuardActive) {
      this.isRootGuardActive = true;
      if (!window.history.state?.__appRootGuard && !window.history.state?.__appModalId) {
        try {
          window.history.pushState({ __appRootGuard: true }, '', window.location.href);
        } catch (e) {
          console.warn('[BackManager] Failed to push root guard:', e);
        }
      }
    }
  }

  public disableRootGuard() {
    this.isRootGuardActive = false;
  }

  public getStackLength(): number {
    return this.stack.length;
  }
}

export const backManager = new BackManager();
