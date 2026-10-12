import { useEffect, useState } from 'react';

// Night view. 'system' follows the phone/PC setting. The `dark` class on <html>
// switches the palette in index.css; the same logic runs in index.html before
// the app loads so there is no white flash.
export type ThemeMode = 'light' | 'dark' | 'system';

const KEY = 'pg-theme';

const readMode = (): ThemeMode => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* storage blocked - fall through */
  }
  return 'system';
};

const prefersDark = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

const apply = (mode: ThemeMode) => {
  const dark = mode === 'dark' || (mode === 'system' && prefersDark());
  document.documentElement.classList.toggle('dark', dark);
};

// Receipts, statements and agreements always print in light colours.
if (typeof window !== 'undefined') {
  let wasDark = false;
  window.addEventListener('beforeprint', () => {
    wasDark = document.documentElement.classList.contains('dark');
    document.documentElement.classList.remove('dark');
  });
  window.addEventListener('afterprint', () => {
    if (wasDark) document.documentElement.classList.add('dark');
  });
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(readMode);

  useEffect(() => {
    apply(mode);
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mode]);

  const setMode = (m: ThemeMode) => {
    try {
      localStorage.setItem(KEY, m);
    } catch {
      /* storage blocked - still applies for this visit */
    }
    setModeState(m);
  };

  return { mode, setMode };
}
