<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { api, ApiError } from '$client/lib/api';
  import Button from '$client/lib/ui/Button.svelte';
  import Skeleton from '$client/lib/ui/Skeleton.svelte';
  import Toolbar from '$client/lib/ui/Toolbar.svelte';
  import EmptyState from '$client/lib/ui/EmptyState.svelte';
  import FieldDisplay from './FieldDisplay.svelte';
  import type { Resource } from '$shared/resource-schema';

  interface Props {
    resource: Resource;
    recordId: string;
  }

  let { resource, recordId }: Props = $props();

  let record = $state<Record<string, unknown> | null>(null);
  let loading = $state(true);
  let errorMsg = $state<string | null>(null);

  async function load() {
    loading = true;
    errorMsg = null;
    try {
      record = await api<Record<string, unknown>>(
        `/api/resources/${resource.id}/detail/${encodeURIComponent(recordId)}`,
      );
    } catch (err) {
      errorMsg = err instanceof ApiError ? `Failed to load (${err.status})` : 'Failed to load';
    } finally {
      loading = false;
    }
  }

  onMount(load);
  $effect(() => { recordId; resource.id; load(); });
</script>

<div class="space-y-4">
  <Toolbar>
    {#snippet left()}
      <nav class="text-xs text-[var(--color-muted)]">
        <a href={`#/r/${resource.id}`} class="hover:text-[var(--color-text)]">{resource.name}</a>
        <span> · </span>
        <span class="font-mono">{recordId}</span>
      </nav>
    {/snippet}
    {#snippet right()}
      {#if !loading && record && resource.update?.enabled}
        <Button variant="secondary" onclick={() => push(`/r/${resource.id}/${recordId}/edit`)}>Edit</Button>
      {/if}
    {/snippet}
  </Toolbar>

  {#if loading}
    <dl class="grid grid-cols-[160px_1fr] gap-y-2 text-sm">
      {#each Array(6) as _}
        <dt class="text-[var(--color-muted)] text-xs pt-1"><Skeleton width="80%" /></dt>
        <dd><Skeleton width="40%" /></dd>
      {/each}
    </dl>
  {:else if errorMsg}
    <EmptyState title="Couldn't load record" description={errorMsg} />
  {:else if record}
    <header>
      <h1 class="text-xl font-semibold tracking-tight">{resource.name}</h1>
    </header>
    <dl class="grid grid-cols-[160px_1fr] gap-y-2 text-sm">
      {#each resource.fields as f}
        <dt class="text-[var(--color-muted)] text-xs pt-1">{f.label}</dt>
        <dd><FieldDisplay field={f} value={record[f.key]} /></dd>
      {/each}
    </dl>
  {/if}
</div>
