<script lang="ts">
  import type { Snippet } from 'svelte';
  interface Props {
    left?: Snippet;
    right?: Snippet;
  }
  let { left, right }: Props = $props();
</script>

<div class="flex items-center justify-between gap-4 py-2">
  <div class="flex items-center gap-3 flex-1 min-w-0">
    {#if left}{@render left()}{/if}
  </div>
  <div class="flex items-center gap-2">
    {#if right}{@render right()}{/if}
  </div>
</div>
