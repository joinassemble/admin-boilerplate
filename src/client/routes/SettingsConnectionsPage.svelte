<script lang="ts">
  import { onMount } from 'svelte';
  import { api, ApiError } from '$client/lib/api';
  import { toast } from '$client/lib/toast.svelte.ts';
  import Button from '$client/lib/ui/Button.svelte';
  import Field from '$client/lib/ui/Field.svelte';
  import Input from '$client/lib/ui/Input.svelte';
  import Pill from '$client/lib/ui/Pill.svelte';

  interface ConnectionListed {
    id: string;
    name: string;
    baseUrl: string;
    authType: 'none' | 'bearer' | 'header' | 'basic';
    isConfigured: boolean;
  }

  let items = $state<ConnectionListed[]>([]);
  let loading = $state(true);
  let openId = $state<string | null>(null);
  let formValues = $state<Record<string, string>>({});
  let saving = $state<string | null>(null);

  async function load() {
    loading = true;
    try {
      items = await api<ConnectionListed[]>('/api/connections');
    } catch {
      toast.error('Failed to load connections');
    } finally {
      loading = false;
    }
  }
  onMount(load);

  function toggle(id: string): void {
    openId = openId === id ? null : id;
    formValues = {};
  }

  async function submit(conn: ConnectionListed): Promise<void> {
    saving = conn.id;
    try {
      const body: Record<string, string> = { type: conn.authType };
      if (conn.authType === 'bearer') body.token = formValues.token ?? '';
      if (conn.authType === 'header') body.value = formValues.value ?? '';
      if (conn.authType === 'basic') {
        body.username = formValues.username ?? '';
        body.password = formValues.password ?? '';
      }
      await api(`/api/connections/${conn.id}`, { method: 'PUT', body: JSON.stringify(body) });
      toast.success('Saved');
      openId = null;
      await load();
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      toast.error(`Save failed (${status || 'network'})`);
    } finally {
      saving = null;
    }
  }
</script>

<div class="space-y-4 max-w-3xl">
  <header>
    <h1 class="text-xl font-semibold tracking-tight">Connections</h1>
    <p class="text-sm text-[var(--color-muted)]">Configure the API credentials your resources use.</p>
  </header>

  {#if loading}
    <p class="text-sm text-[var(--color-muted)]">Loading…</p>
  {:else if items.length === 0}
    <p class="text-sm text-[var(--color-muted)]">
      No connections declared. Add one in <code class="font-mono">src/connections/</code>.
    </p>
  {:else}
    <ul class="border border-[var(--color-border)] rounded-md divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
      {#each items as conn}
        <li class="p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-medium">{conn.name}</div>
              <div class="text-xs text-[var(--color-muted)] font-mono">{conn.id} · {conn.baseUrl}</div>
            </div>
            <div class="flex items-center gap-2">
              {#if conn.isConfigured}
                <Pill tone="success">configured</Pill>
              {:else}
                <Pill tone="warning">unconfigured</Pill>
              {/if}
              <Button variant="secondary" size="sm" onclick={() => toggle(conn.id)}>
                {openId === conn.id ? 'Cancel' : conn.isConfigured ? 'Rotate' : 'Configure'}
              </Button>
            </div>
          </div>

          {#if openId === conn.id}
            <form
              class="space-y-3 border-t border-[var(--color-border)] pt-3"
              onsubmit={(e) => { e.preventDefault(); void submit(conn); }}
            >
              <p class="text-xs text-[var(--color-muted)]">Auth type: <span class="font-mono">{conn.authType}</span></p>

              {#if conn.authType === 'none'}
                <p class="text-xs text-[var(--color-muted)]">No secret required. Click Save to mark configured.</p>
              {:else if conn.authType === 'bearer'}
                <Field label="Token" required>
                  <Input type="text" bind:value={formValues.token} placeholder="sk_…" monospace required />
                </Field>
              {:else if conn.authType === 'header'}
                <Field label="Header value" required>
                  <Input type="text" bind:value={formValues.value} placeholder="…" monospace required />
                </Field>
              {:else if conn.authType === 'basic'}
                <Field label="Username" required>
                  <Input type="text" bind:value={formValues.username} required />
                </Field>
                <Field label="Password" required>
                  <Input type="text" bind:value={formValues.password} required />
                </Field>
              {/if}

              <div class="flex gap-2">
                <Button type="submit" disabled={saving === conn.id}>
                  {saving === conn.id ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </form>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
