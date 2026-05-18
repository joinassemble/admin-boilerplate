<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { api, ApiError } from '$client/lib/api';
  import Button from '$client/lib/ui/Button.svelte';
  import Table from '$client/lib/ui/Table.svelte';
  import EmptyState from '$client/lib/ui/EmptyState.svelte';
  import Skeleton from '$client/lib/ui/Skeleton.svelte';
  import Toolbar from '$client/lib/ui/Toolbar.svelte';
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
  let errorStatus = $state<number | null>(null);
  let cursor = $state<string | null>(null);
  let hasMore = $state(false);

  // Sorting state (client-side, current page only).
  let sortKey = $state<string | null>(null);
  let sortDir = $state<'asc' | 'desc'>('asc');

  const columns = $derived(resource.fields.filter((f) => f.tableColumn));
  const primaryField = $derived(resource.fields.find((f) => f.primary));

  function toggleSort(key: string): void {
    if (sortKey === key) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortKey = key;
      sortDir = 'asc';
    }
  }

  const sortedRows = $derived.by(() => {
    if (!sortKey) return rows;
    const key = sortKey;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return -dir;
      if (bv == null) return dir;
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return 0;
    });
  });

  async function load(c: string | null = null) {
    loading = true;
    errorMsg = null;
    errorStatus = null;
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
        errorStatus = err.status;
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
  <Toolbar>
    {#snippet left()}
      <div>
        <h1 class="text-xl font-semibold tracking-tight">{resource.name}</h1>
        {#if resource.group}
          <p class="text-xs text-[var(--color-muted)]">{resource.group}</p>
        {/if}
      </div>
    {/snippet}
    {#snippet right()}
      {#if resource.create?.enabled}
        <Button onclick={() => push(`/r/${resource.id}/new`)}>New</Button>
      {/if}
    {/snippet}
  </Toolbar>

  {#if loading}
    <Table>
      <thead>
        <tr>
          {#each columns as col}
            <th>{col.label}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each Array(5) as _, i (i)}
          <tr>
            {#each columns as _col, j (j)}
              <td><Skeleton width="60%" /></td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </Table>
  {:else if errorMsg}
    <EmptyState
      title="Couldn't load records"
      description={errorStatus === 412
        ? `The "${resource.connection}" connection isn't configured yet.`
        : errorMsg}
    />
  {:else if sortedRows.length === 0}
    <EmptyState
      title="No records"
      description={resource.create?.enabled ? 'Click New to add the first one.' : 'Nothing to show yet.'}
    />
  {:else}
    <Table>
      <thead>
        <tr>
          {#each columns as col}
            <th>
              <button
                type="button"
                class="inline-flex items-center gap-1 hover:text-[var(--color-text)] transition-colors focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style:outline-color="var(--focus-ring-color)"
                onclick={() => toggleSort(col.key)}
              >
                {col.label}
                {#if sortKey === col.key}
                  <span class="text-[10px]" aria-hidden="true">{sortDir === 'asc' ? '↑' : '↓'}</span>
                {/if}
              </button>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each sortedRows as row}
          <tr class="clickable" onclick={() => openRow(row)}>
            {#each columns as col}
              <td><FieldDisplay field={col} value={row[col.key]} /></td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </Table>

    {#if hasMore}
      <div class="flex justify-end pt-2">
        <Button variant="secondary" onclick={next}>Next →</Button>
      </div>
    {/if}
  {/if}
</div>
