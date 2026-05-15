<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { registry } from '$client/lib/registry.svelte';

  // If there are resources, jump to the first one. Otherwise show a hint.
  onMount(() => {
    if (registry.status === 'ready' && registry.items.length > 0) {
      push(`/r/${registry.items[0].id}`);
    }
  });

  $effect(() => {
    if (registry.status === 'ready' && registry.items.length > 0) {
      push(`/r/${registry.items[0].id}`);
    }
  });
</script>

<div class="space-y-2">
  <h1 class="text-xl font-semibold tracking-tight">admin-boilerplate</h1>
  <p class="text-sm text-[var(--color-muted)]">
    {#if registry.status === 'loading'}
      Loading resources…
    {:else if registry.items.length === 0}
      No resources registered. Drop a file in <code class="font-mono">src/resources/</code> and add it to <code class="font-mono">src/resources/index.ts</code>.
    {:else}
      Pick a resource from the sidebar.
    {/if}
  </p>
</div>
