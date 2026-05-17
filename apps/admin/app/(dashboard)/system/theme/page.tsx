'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useSession } from 'next-auth/react';
import { adminFetch } from '@/lib/api';
import { PageShell } from '@/components/page-shell';
import {
  Banner,
  PrimaryButton,
  SurfaceCard,
  SurfaceHeader,
} from '@/components/admin-ui';

interface Preset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly primary: string;
  readonly primaryContainer: string;
  readonly surface: string;
  readonly ink: string;
}

const PRESETS: readonly Preset[] = [
  {
    id: 'editorial-red',
    name: 'Editorial Red',
    description: 'Default — deep red on paper cream.',
    primary: '#b8111d',
    primaryContainer: '#dc3133',
    surface: '#fbf9f8',
    ink: '#030302',
  },
  {
    id: 'indigo',
    name: 'Deep Indigo',
    description: 'Night-shift indigo for after-hours drops.',
    primary: '#2f3aa3',
    primaryContainer: '#4c5ac6',
    surface: '#fbf9f8',
    ink: '#030302',
  },
  {
    id: 'forest',
    name: 'Atelier Forest',
    description: 'Earthy green with neutral paper.',
    primary: '#2f6b3a',
    primaryContainer: '#4a9458',
    surface: '#f6f4ef',
    ink: '#121712',
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Inverted — ink surface with ivory accents.',
    primary: '#d4b16a',
    primaryContainer: '#e4c382',
    surface: '#121212',
    ink: '#f5f3f3',
  },
];

const STORAGE_KEY = 'denimisia.admin.theme-preset';

function applyPreset(preset: Preset) {
  const root = document.documentElement;
  root.style.setProperty('--color-primary', preset.primary);
  root.style.setProperty('--color-primary-container', preset.primaryContainer);
  root.style.setProperty('--color-surface', preset.surface);
  root.style.setProperty('--color-background', preset.surface);
  root.style.setProperty('--color-ink', preset.ink);
}

export default function ThemeManagerPage() {
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const token = session?.accessToken;
  const [activeId, setActiveId] = useState('editorial-red');
  const [saved, setSaved] = useState(false);
  const [savedMessage, setSavedMessage] = useState('Preset saved');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const preset = PRESETS.find((p) => p.id === stored);
      if (preset) {
        setActiveId(preset.id);
        applyPreset(preset);
      }
    }
  }, []);

  const persistPreset = async (preset: Preset): Promise<'remote' | 'local'> => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, preset.id);
    }
    if (!token) return 'local';
    try {
      await adminFetch('/settings/theme', token, {
        method: 'PATCH',
        body: JSON.stringify({ presetId: preset.id }),
      });
      return 'remote';
    } catch {
      // Graceful fallback: 404 or any other error — we already wrote localStorage.
      return 'local';
    }
  };

  const select = (preset: Preset) => {
    setActiveId(preset.id);
    applyPreset(preset);
    void persistPreset(preset).then((outcome) => {
      setSavedMessage(
        outcome === 'remote' ? 'Preset saved' : 'Preset saved locally (backend pending)',
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  return (
    <PageShell
      title="Theme Manager"
      description="Switch palettes, preview live, and set the atelier's mood."
      breadcrumbs={[{ label: 'System' }, { label: 'Theme' }]}
    >
      <Banner
        tone="info"
        message="Admin theme preference — saved to this browser only. Does not affect the storefront."
      />
      {saved && <Banner tone="success" message={savedMessage} />}

      <SurfaceCard className="mb-6">
        <SurfaceHeader
          action={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={
                  'px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] transition-colors duration-300 ease-editorial ' +
                  (theme === 'light'
                    ? 'border-b-2 border-on-surface text-on-surface'
                    : 'text-secondary hover:text-on-surface')
                }
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={
                  'px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] transition-colors duration-300 ease-editorial ' +
                  (theme === 'dark'
                    ? 'border-b-2 border-on-surface text-on-surface'
                    : 'text-secondary hover:text-on-surface')
                }
              >
                Dark
              </button>
              <button
                type="button"
                onClick={() => setTheme('system')}
                className={
                  'px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] transition-colors duration-300 ease-editorial ' +
                  (theme === 'system'
                    ? 'border-b-2 border-on-surface text-on-surface'
                    : 'text-secondary hover:text-on-surface')
                }
              >
                System
              </button>
            </div>
          }
        >
          Mode
        </SurfaceHeader>
        <div className="p-6">
          <p className="font-body text-sm text-secondary">
            Choose how the admin renders — light paper, obsidian ink, or follow your OS.
          </p>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <SurfaceHeader>Palette Presets</SurfaceHeader>
        <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2">
          {PRESETS.map((preset) => {
            const active = preset.id === activeId;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => select(preset)}
                className={
                  'group relative flex flex-col overflow-hidden border text-left transition-colors duration-300 ease-editorial ' +
                  (active
                    ? 'border-on-surface'
                    : 'border-outline-variant/20 hover:border-outline-variant/50')
                }
              >
                <div className="flex h-24" style={{ backgroundColor: preset.surface }}>
                  <div className="flex-1" style={{ backgroundColor: preset.primary }} />
                  <div
                    className="flex-1"
                    style={{ backgroundColor: preset.primaryContainer }}
                  />
                  <div className="flex-1" style={{ backgroundColor: preset.ink }} />
                  <div className="flex-1" style={{ backgroundColor: preset.surface }} />
                </div>
                <div className="flex items-start justify-between gap-4 p-5">
                  <div>
                    <p className="font-headline text-sm font-semibold uppercase tracking-[0.15em] text-on-surface">
                      {preset.name}
                    </p>
                    <p className="mt-1 font-body text-xs text-secondary">
                      {preset.description}
                    </p>
                  </div>
                  {active && (
                    <span
                      className="material-symbols-outlined text-on-surface"
                      aria-hidden
                    >
                      check_circle
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </SurfaceCard>

      <div className="mt-6 flex justify-end">
        <PrimaryButton
          icon="restart_alt"
          onClick={() => {
            if (typeof window !== 'undefined') {
              localStorage.removeItem(STORAGE_KEY);
            }
            const defaultPreset = PRESETS[0]!;
            setActiveId(defaultPreset.id);
            applyPreset(defaultPreset);
            setSavedMessage('Reset to default');
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }}
        >
          Reset to Default
        </PrimaryButton>
      </div>
    </PageShell>
  );
}
