<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    label: string;
    helper?: string;
    error?: string;
    required?: boolean;
    children: Snippet;
  }

  let { label, helper, error, required, children }: Props = $props();
</script>

<label class="block space-y-1">
  <span class="text-xs font-medium text-[var(--color-muted)]">
    {label}
    {#if required}<span class="text-[var(--color-error-fg)]" aria-hidden="true">*</span>{/if}
  </span>
  {@render children()}
  {#if error}
    <p class="text-xs text-[var(--color-error-fg)]">{error}</p>
  {:else if helper}
    <p class="text-xs text-[var(--color-muted)]">{helper}</p>
  {/if}
</label>
