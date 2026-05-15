<script lang="ts">
  import { onMount } from 'svelte';
  import { api, ApiError } from '$client/lib/api';
  import { toast } from '$client/lib/toast.svelte';
  import Button from '$client/lib/ui/Button.svelte';
  import Field from '$client/lib/ui/Field.svelte';
  import Input from '$client/lib/ui/Input.svelte';
  import Table from '$client/lib/ui/Table.svelte';

  interface Entry {
    email: string;
    orgId: string | null;
    role: string | null;
    addedAt: number;
    addedBy: string;
  }

  let items = $state<Entry[]>([]);
  let loading = $state(true);
  let saving = $state(false);

  let newEmail = $state('');
  let newOrgId = $state('');
  let newRole = $state('');

  async function load() {
    loading = true;
    try { items = await api<Entry[]>('/api/access'); }
    catch { toast.error('Failed to load'); }
    finally { loading = false; }
  }
  onMount(load);

  async function add(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    if (saving) return;
    saving = true;
    try {
      await api('/api/access', { method: 'POST', body: JSON.stringify({
        email: newEmail,
        orgId: newOrgId || undefined,
        role: newRole || undefined,
      }) });
      toast.success('Added');
      newEmail = ''; newOrgId = ''; newRole = '';
      await load();
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      toast.error(`Add failed (${status || 'network'})`);
    } finally { saving = false; }
  }

  async function remove(email: string): Promise<void> {
    try {
      await api(`/api/access/${encodeURIComponent(email)}`, { method: 'DELETE' });
      toast.success('Removed');
      await load();
    } catch {
      toast.error('Remove failed');
    }
  }
</script>

<div class="space-y-4 max-w-3xl">
  <header>
    <h1 class="text-xl font-semibold tracking-tight">Access</h1>
    <p class="text-sm text-[var(--color-muted)]">
      Individual emails the <code class="font-mono">DomainAllowlistPolicy</code> admits in addition to the domain rules.
    </p>
  </header>

  <form class="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-end" onsubmit={add}>
    <Field label="Email" required>
      <Input type="email" bind:value={newEmail} required placeholder="user@example.com" />
    </Field>
    <Field label="Org ID (optional)">
      <Input type="text" bind:value={newOrgId} placeholder="acme" />
    </Field>
    <Field label="Role (optional)">
      <Input type="text" bind:value={newRole} placeholder="editor" />
    </Field>
    <Button type="submit" disabled={saving}>Add</Button>
  </form>

  {#if loading}
    <p class="text-sm text-[var(--color-muted)]">Loading…</p>
  {:else if items.length === 0}
    <p class="text-sm text-[var(--color-muted)]">No individual emails. Domain rules in <code class="font-mono">ALLOWED_DOMAINS</code> still apply.</p>
  {:else}
    <Table>
      <thead>
        <tr><th>Email</th><th>Org</th><th>Role</th><th>Added by</th><th></th></tr>
      </thead>
      <tbody>
        {#each items as e}
          <tr>
            <td class="font-mono text-xs">{e.email}</td>
            <td>{e.orgId ?? '—'}</td>
            <td>{e.role ?? '—'}</td>
            <td class="text-xs text-[var(--color-muted)]">{e.addedBy}</td>
            <td><Button variant="ghost" size="sm" onclick={() => remove(e.email)}>Remove</Button></td>
          </tr>
        {/each}
      </tbody>
    </Table>
  {/if}
</div>
