<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { api, ApiError } from '$client/lib/api';
  import Button from '$client/lib/ui/Button.svelte';
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
  <nav class="text-xs text-[var(--color-muted)]">
    <a href={`#/r/${resource.id}`} class="hover:text-[var(--color-text)]">{resource.name}</a>
    <span> · </span>
    <span class="font-mono">{recordId}</span>
  </nav>

  {#if loading}
    <p class="text-sm text-[var(--color-muted)]">Loading…</p>
  {:else if errorMsg}
    <p class="text-sm text-[var(--color-error-fg)]">{errorMsg}</p>
  {:else if record}
    <header class="flex items-center justify-between">
      <h1 class="text-xl font-semibold tracking-tight">{resource.name}</h1>
      <div class="flex gap-2">
        {#if resource.update?.enabled}
          <Button variant="secondary" onclick={() => push(`/r/${resource.id}/${recordId}/edit`)}>Edit</Button>
        {/if}
      </div>
    </header>

    <dl class="grid grid-cols-[160px_1fr] gap-y-2 text-sm">
      {#each resource.fields as f}
        <dt class="text-[var(--color-muted)] text-xs pt-1">{f.label}</dt>
        <dd><FieldDisplay field={f} value={record[f.key]} /></dd>
      {/each}
    </dl>
  {/if}
</div>
