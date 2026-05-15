<script lang="ts">
  import { onMount } from 'svelte';
  import { api, ApiError } from '$client/lib/api';
  import { toast } from '$client/lib/toast.svelte';
  import Button from '$client/lib/ui/Button.svelte';
  import Input from '$client/lib/ui/Input.svelte';
  import Pill from '$client/lib/ui/Pill.svelte';
  import Table from '$client/lib/ui/Table.svelte';

  interface UserRow {
    email: string;
    orgId: string | null;
    role: string | null;
    lastSeenAt: number;
    bannedAt: number | null;
  }

  let items = $state<UserRow[]>([]);
  let loading = $state(true);
  let editingEmail = $state<string | null>(null);
  let editOrgId = $state('');
  let editRole = $state('');

  async function load() {
    loading = true;
    try { items = await api<UserRow[]>('/api/users'); }
    catch { toast.error('Failed to load'); }
    finally { loading = false; }
  }
  onMount(load);

  function startEdit(u: UserRow): void {
    editingEmail = u.email;
    editOrgId = u.orgId ?? '';
    editRole = u.role ?? '';
  }

  async function saveEdit(email: string): Promise<void> {
    try {
      await api(`/api/users/${encodeURIComponent(email)}`, {
        method: 'PATCH',
        body: JSON.stringify({ orgId: editOrgId || null, role: editRole || null }),
      });
      toast.success('Saved');
      editingEmail = null;
      await load();
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      toast.error(`Save failed (${status || 'network'})`);
    }
  }

  async function toggleBan(u: UserRow): Promise<void> {
    try {
      await api(`/api/users/${encodeURIComponent(u.email)}`, {
        method: 'PATCH',
        body: JSON.stringify({ banned: !u.bannedAt }),
      });
      toast.success(u.bannedAt ? 'Unbanned' : 'Banned');
      await load();
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      toast.error(`Failed (${status || 'network'})`);
    }
  }

  function fmtTs(ts: number): string {
    return new Date(ts * 1000).toISOString().slice(0, 10);
  }
</script>

<div class="space-y-4 max-w-4xl">
  <header>
    <h1 class="text-xl font-semibold tracking-tight">Users</h1>
    <p class="text-sm text-[var(--color-muted)]">
      Created on first sign-in under domain / open registration policies.
    </p>
  </header>

  {#if loading}
    <p class="text-sm text-[var(--color-muted)]">Loading…</p>
  {:else if items.length === 0}
    <p class="text-sm text-[var(--color-muted)]">
      No users yet. (None are created under <code class="font-mono">EnvAllowlistPolicy</code>.)
    </p>
  {:else}
    <Table>
      <thead>
        <tr><th>Email</th><th>Org</th><th>Role</th><th>Last seen</th><th>Status</th><th></th></tr>
      </thead>
      <tbody>
        {#each items as u}
          <tr>
            <td class="font-mono text-xs">{u.email}</td>
            {#if editingEmail === u.email}
              <td><Input type="text" bind:value={editOrgId} placeholder="—" /></td>
              <td><Input type="text" bind:value={editRole} placeholder="—" /></td>
            {:else}
              <td>{u.orgId ?? '—'}</td>
              <td>{u.role ?? '—'}</td>
            {/if}
            <td class="text-xs font-mono">{fmtTs(u.lastSeenAt)}</td>
            <td>{#if u.bannedAt}<Pill tone="error">banned</Pill>{:else}<Pill tone="success">active</Pill>{/if}</td>
            <td class="space-x-1">
              {#if editingEmail === u.email}
                <Button size="sm" onclick={() => saveEdit(u.email)}>Save</Button>
                <Button size="sm" variant="ghost" onclick={() => (editingEmail = null)}>Cancel</Button>
              {:else}
                <Button size="sm" variant="secondary" onclick={() => startEdit(u)}>Edit</Button>
                <Button size="sm" variant="ghost" onclick={() => toggleBan(u)}>{u.bannedAt ? 'Unban' : 'Ban'}</Button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </Table>
  {/if}
</div>
