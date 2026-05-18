<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    density?: 'comfortable' | 'compact';
    children: Snippet;
  }

  let { density = 'comfortable', children }: Props = $props();
</script>

<div class="overflow-x-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
  <table class="w-full text-sm" class:compact={density === 'compact'}>
    {@render children()}
  </table>
</div>

<style>
  :global(table th) {
    text-align: left;
    padding: 8px 14px;
    background: var(--color-surface-2);
    color: var(--color-muted);
    font-weight: 500;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-bottom: 1px solid var(--color-border);
  }
  :global(table td) {
    padding: 10px 14px;
    border-bottom: 1px solid var(--color-border);
    vertical-align: top;
  }
  :global(table.compact th) {
    padding: 6px 10px;
  }
  :global(table.compact td) {
    padding: 6px 10px;
  }
  :global(table tbody tr:last-child td) {
    border-bottom: none;
  }
  :global(table tbody tr) {
    transition: background var(--motion-fast) var(--motion-easing);
  }
  :global(table tbody tr:hover) {
    background: var(--color-surface-2);
  }
  :global(table tbody tr.clickable) {
    cursor: pointer;
  }
</style>
