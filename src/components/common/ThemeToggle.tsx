import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, ThemeMode } from '../../lib/theme';

const NEXT: Record<ThemeMode, ThemeMode> = { light: 'dark', dark: 'system', system: 'light' };
const LABEL: Record<ThemeMode, string> = { light: 'Day view', dark: 'Night view', system: 'Auto (follows device)' };

// One button that cycles Day -> Night -> Auto.
export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { mode, setMode } = useTheme();
  const Icon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Monitor;
  return (
    <button
      type="button"
      onClick={() => setMode(NEXT[mode])}
      title={`${LABEL[mode]} - tap to change`}
      aria-label={`Theme: ${LABEL[mode]}`}
      className={`p-2 rounded-xl border transition ${className}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
};
