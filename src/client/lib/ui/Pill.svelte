<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    tone?: 'neutral' | 'success' | 'warning' | 'error' | 'info';
    border?: boolean;
    children: Snippet;
  }

  let { tone = 'neutral', border = false, children }: Props = $props();

  const tones = {
    neutral: 'bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]',
    success: 'bg-[var(--color-success-bg)] text-[var(--color-success-fg)]',
    warning: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-fg)]',
    error:   'bg-[var(--color-error-bg)] text-[var(--color-error-fg)]',
    info:    'bg-[var(--color-info-bg)] text-[var(--color-info-fg)]',
  };
</script>

<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium {tones[tone]} {border ? 'border border-[var(--color-border)]' : ''}">
  {@render children()}
</span>
