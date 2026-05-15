<script lang="ts">
  import { registry } from '$client/lib/registry.svelte';
  import ResourceForm from '$client/lib/resource/ResourceForm.svelte';

  interface Props { params: { id: string; recordId?: string } }
  let { params }: Props = $props();
  const resource = $derived(registry.byId(params.id));
</script>

{#if !resource}
  <p class="text-sm text-[var(--color-muted)]">Unknown resource.</p>
{:else}
  <ResourceForm {resource} recordId={params.recordId} />
{/if}
