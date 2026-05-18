<script lang="ts">
  import type { Snippet } from 'svelte';
  interface Props {
    label: string;
    value: string | number;
    delta?: string;
    tone?: 'neutral' | 'positive' | 'negative';
    children?: Snippet;   // optional sub-line
  }
  let { label, value, delta, tone = 'neutral', children }: Props = $props();

  const tones = {
    neutral:  'text-[var(--color-muted)]',
    positive: 'text-[var(--color-success-fg)]',
    negative: 'text-[var(--color-error-fg)]',
  };
</script>

<div class="border border-[var(--color-border)] rounded-md bg-[var(--color-surface)] p-4">
  <p class="text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)] font-medium">{label}</p>
  <p class="text-2xl font-semibold tracking-tight mt-1">{value}</p>
  {#if delta}
    <p class="text-xs mt-1 {tones[tone]}">{delta}</p>
  {/if}
  {#if children}
    <div class="mt-2 text-xs text-[var(--color-muted)]">{@render children()}</div>
  {/if}
</div>
