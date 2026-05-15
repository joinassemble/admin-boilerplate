<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$client/lib/api';
  import { toast } from '$client/lib/toast.svelte';
  import Pill from '$client/lib/ui/Pill.svelte';
  import Table from '$client/lib/ui/Table.svelte';

  interface Entry {
    id: number;
    ts: number;
    actor_email: string | null;
    actor_role: string | null;
    action: string;
    resource_id: string | null;
    record_id: string | null;
    connection_id: string | null;
    detail_json: string | null;
    ip: string | null;
  }

  let items = $state<Entry[]>([]);
  let loading = $state(true);

  async function load() {
    loading = true;
    try { items = await api<Entry[]>('/api/audit?limit=200'); }
    catch { toast.error('Failed to load'); }
    finally { loading = false; }
  }
  onMount(load);

  function fmtTs(ts: number): string {
    return new Date(ts * 1000).toISOString().replace('T', ' ').slice(0, 19);
  }
  function tone(action: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
    if (action === 'sign_in') return 'success';
    if (action === 'sign_out') return 'neutral';
    if (action.startsWith('user.ban')) return 'error';
    if (action.startsWith('user.unban')) return 'success';
    if (action.startsWith('access.')) return 'info';
    if (action.startsWith('connection.')) return 'warning';
    if (action.startsWith('resource.create')) return 'info';
    if (action.startsWith('resource.update')) return 'info';
    if (action.startsWith('resource.delete')) return 'error';
    return 'neutral';
  }
</script>

<div class="space-y-4">
  <header>
    <h1 class="text-xl font-semibold tracking-tight">Audit log</h1>
    <p class="text-sm text-[var(--color-muted)]">Recent events. Latest 200.</p>
  </header>

  {#if loading}
    <p class="text-sm text-[var(--color-muted)]">Loading…</p>
  {:else if items.length === 0}
    <p class="text-sm text-[var(--color-muted)]">No entries yet.</p>
  {:else}
    <Table>
      <thead>
        <tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>IP</th></tr>
      </thead>
      <tbody>
        {#each items as e}
          <tr>
            <td class="font-mono text-xs">{fmtTs(e.ts)}</td>
            <td class="text-xs">{e.actor_email ?? '—'}</td>
            <td><Pill tone={tone(e.action)}>{e.action}</Pill></td>
            <td class="text-xs font-mono">
              {[e.connection_id, e.resource_id, e.record_id].filter(Boolean).join(' / ') || '—'}
            </td>
            <td class="text-xs font-mono text-[var(--color-muted)]">{e.ip ?? '—'}</td>
          </tr>
        {/each}
      </tbody>
    </Table>
  {/if}
</div>
