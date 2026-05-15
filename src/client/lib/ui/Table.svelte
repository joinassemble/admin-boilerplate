<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<div class="overflow-x-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
  <table class="w-full text-sm">
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
  :global(table tbody tr:last-child td) {
    border-bottom: none;
  }
  :global(table tbody tr) {
    transition: background 80ms ease;
  }
  :global(table tbody tr:hover) {
    background: var(--color-surface-2);
  }
  :global(table tbody tr.clickable) {
    cursor: pointer;
  }
</style>
