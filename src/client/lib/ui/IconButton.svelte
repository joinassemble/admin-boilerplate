<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    ariaLabel: string;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
  }

  let { type = 'button', disabled = false, ariaLabel, onclick, children }: Props = $props();
</script>

<button
  {type}
  {disabled}
  {onclick}
  aria-label={ariaLabel}
  class="inline-flex items-center justify-center w-8 h-8 rounded-md text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors focus:outline-none focus-visible:ring-2 disabled:opacity-50"
>
  {@render children()}
</button>
