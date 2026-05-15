export type ThemeChoice = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'admin-boilerplate.theme';

class ThemeStore {
  choice = $state<ThemeChoice>(readInitial());
  systemPref = $state<ResolvedTheme>(detectSystem());

  resolved = $derived<ResolvedTheme>(
    this.choice === 'system' ? this.systemPref : this.choice,
  );

  constructor() {
    if (typeof window !== 'undefined') {
      // Listen for system-pref changes so 'system' followers track them.
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      mql.addEventListener('change', (e) => {
        this.systemPref = e.matches ? 'dark' : 'light';
      });
    }
  }

  /** Cycle light → dark → system → light. Used by the topbar toggle. */
  cycle(): void {
    const next: ThemeChoice =
      this.choice === 'light' ? 'dark' : this.choice === 'dark' ? 'system' : 'light';
    this.set(next);
  }

  set(choice: ThemeChoice): void {
    this.choice = choice;
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, choice);
    }
  }

  /** Apply the resolved theme to the document. Call this once on mount, plus on every change via $effect. */
  apply(): void {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', this.resolved);
    }
  }
}

function readInitial(): ThemeChoice {
  if (typeof window === 'undefined') return 'system';
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
}

function detectSystem(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const theme = new ThemeStore();
