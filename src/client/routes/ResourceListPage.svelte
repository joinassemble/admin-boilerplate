<script lang="ts">
  import { registry } from '$client/lib/registry.svelte';
  import ResourceTable from '$client/lib/resource/ResourceTable.svelte';

  interface Props { params: { id: string } }
  let { params }: Props = $props();
  const resource = $derived(registry.byId(params.id));
</script>

{#if !resource}
  <p class="text-sm text-[var(--color-muted)]">Unknown resource.</p>
{:else}
  <ResourceTable {resource} />
{/if}
