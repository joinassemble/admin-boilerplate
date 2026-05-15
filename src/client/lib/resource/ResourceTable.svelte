<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { api, ApiError } from '$client/lib/api';
  import Button from '$client/lib/ui/Button.svelte';
  import Table from '$client/lib/ui/Table.svelte';
  import FieldDisplay from './FieldDisplay.svelte';
  import type { Resource } from '$shared/resource-schema';

  interface Props {
    resource: Resource;
  }

  let { resource }: Props = $props();

  type Row = Record<string, unknown>;
  let rows = $state<Row[]>([]);
  let loading = $state(true);
  let errorMsg = $state<string | null>(null);
  let cursor = $state<string | null>(null);
  let hasMore = $state(false);

  const columns = $derived(resource.fields.filter((f) => f.tableColumn));
  const primaryField = $derived(resource.fields.find((f) => f.primary));

  async function load(c: string | null = null) {
    loading = true;
    errorMsg = null;
    try {
      const path = c
        ? `/api/resources/${resource.id}/list?${resource.list.cursorParam ?? 'starting_after'}=${encodeURIComponent(c)}`
        : `/api/resources/${resource.id}/list`;
      const data = await api<Row[] | Row>(path);
      const newRows = Array.isArray(data) ? data : ((data as { data?: Row[] }).data ?? []);
      rows = newRows;
      // Heuristic: if we got at least 10 rows and the resource declares a cursorParam, there might be more.
      hasMore = newRows.length >= 10 && Boolean(resource.list.cursorParam) && Boolean(primaryField);
    } catch (err) {
      if (err instanceof ApiError) {
        errorMsg = `Failed to load (${err.status})`;
      } else {
        errorMsg = 'Failed to load';
      }
      rows = [];
      hasMore = false;
    } finally {
      loading = false;
    }
  }

  onMount(load);
  $effect(() => {
    // Refetch when the resource id changes.
    resource.id;
    load();
  });

  function openRow(row: Row): void {
    const id = primaryField ? row[primaryField.key] : undefined;
    if (id !== undefined) push(`/r/${resource.id}/${id}`);
  }

  function next(): void {
    if (!hasMore || !primaryField) return;
    const last = rows[rows.length - 1];
    if (!last) return;
    const lastId = last[primaryField.key];
    if (lastId !== undefined) {
      cursor = String(lastId);
      void load(cursor);
    }
  }
</script>

<div class="space-y-4">
  <header class="flex items-baseline justify-between">
    <div>
      <h1 class="text-xl font-semibold tracking-tight">{resource.name}</h1>
      {#if resource.group}
        <p class="text-xs text-[var(--color-muted)]">{resource.group}</p>
      {/if}
    </div>
    {#if resource.create?.enabled}
      <Button onclick={() => push(`/r/${resource.id}/new`)}>New</Button>
    {/if}
  </header>

  {#if loading}
    <p class="text-sm text-[var(--color-muted)]">Loading…</p>
  {:else if errorMsg}
    <p class="text-sm text-[var(--color-error-fg)]">{errorMsg}</p>
    {#if errorMsg.includes('412')}
      <p class="text-sm text-[var(--color-muted)]">
        The <code class="font-mono">{resource.connection}</code> connection isn't configured yet.
      </p>
    {/if}
  {:else if rows.length === 0}
    <p class="text-sm text-[var(--color-muted)]">No records.</p>
  {:else}
    <Table>
      <thead>
        <tr>
          {#each columns as col}
            <th>{col.label}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each rows as row}
          <tr class="clickable" onclick={() => openRow(row)}>
            {#each columns as col}
              <td><FieldDisplay field={col} value={row[col.key]} /></td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </Table>
  {/if}

  {#if hasMore && !loading}
    <div class="flex justify-end pt-2">
      <Button variant="secondary" onclick={next}>Next →</Button>
    </div>
  {/if}
</div>
