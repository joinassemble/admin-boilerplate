<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$client/lib/api';
  import { registry } from '$client/lib/registry.svelte';
  import StatCard from '$client/lib/ui/StatCard.svelte';
  import Skeleton from '$client/lib/ui/Skeleton.svelte';
  import EmptyState from '$client/lib/ui/EmptyState.svelte';
  import Pill from '$client/lib/ui/Pill.svelte';
  import Table from '$client/lib/ui/Table.svelte';

  interface Customer {
    id: string;
    status: string;
    mrr_cents: number;
  }

  interface Activity {
    id: string;
    ts: number;
    action: string;
    detail: string;
  }

  let customers = $state<Customer[] | null>(null);
  let activity = $state<Activity[] | null>(null);
  let loading = $state(true);
  let loadError = $state<string | null>(null);

  async function load() {
    loading = true;
    loadError = null;
    try {
      const [cs, ay] = await Promise.all([
        api<Customer[]>('/api/resources/mock-customers/list').catch((e) => {
          loadError = String(e);
          return [];
        }),
        api<Activity[]>('/api/resources/mock-activity/list').catch((e) => {
          loadError = String(e);
          return [];
        }),
      ]);
      customers = cs;
      activity = ay;
    } finally {
      loading = false;
    }
  }

  onMount(load);

  const stats = $derived.by(() => {
    if (!customers) return null;
    const total = customers.length;
    const active = customers.filter((c) => c.status === 'active').length;
    const mrr = customers.reduce((sum, c) => sum + c.mrr_cents, 0);
    const pastDue = customers.filter((c) => c.status === 'past_due').length;
    return { total, active, mrr, pastDue };
  });

  function fmtTs(ts: number): string {
    const seconds = Math.floor(Date.now() / 1000 - ts);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  function fmtCurrency(cents: number): string {
    return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
</script>

<div class="space-y-6">
  <header>
    <h1 class="text-2xl font-semibold tracking-tight">Overview</h1>
    <p class="text-sm text-[var(--color-muted)]">A snapshot of the last 7 days.</p>
  </header>

  {#if loading}
    <div class="grid grid-cols-4 gap-3">
      {#each Array(4) as _, i (i)}
        <div class="border border-[var(--color-border)] rounded-md bg-[var(--color-surface)] p-4 space-y-2">
          <Skeleton width="40%" height="12px" />
          <Skeleton width="60%" height="24px" />
          <Skeleton width="50%" height="12px" />
        </div>
      {/each}
    </div>
  {:else if registry.items.length === 0}
    <EmptyState
      title="No resources yet"
      description="Add a resource in src/resources/ and register it in src/resources/index.ts. See docs/adding-a-resource.md."
    />
  {:else if loadError}
    <EmptyState
      title="Mock connection not configured"
      description={`Run this once in the DevTools console: await fetch('/api/connections/mock', {method:'PUT',headers:{'Content-Type':'application/json'},body:'{"type":"none"}'})`}
    />
  {:else if !stats}
    <!-- Unreachable when both fetches succeed; kept as a safety net. -->
    <EmptyState title="No data" description="Nothing to show." />
  {:else}
    <div class="grid grid-cols-4 gap-3">
      <StatCard label="Total customers" value={stats.total} />
      <StatCard
        label="Active"
        value={stats.active}
        delta={stats.total > 0 ? `${Math.round((stats.active / stats.total) * 100)}% of total` : '—'}
      />
      <StatCard
        label="MRR"
        value={fmtCurrency(stats.mrr)}
        tone="positive"
        delta="from active subscriptions"
      />
      <StatCard
        label="Past due"
        value={stats.pastDue}
        tone={stats.pastDue > 0 ? 'negative' : 'neutral'}
        delta={stats.pastDue > 0 ? 'Need attention' : 'All clear'}
      />
    </div>

    {#if activity && activity.length > 0}
      <section class="space-y-3">
        <h2 class="text-sm uppercase tracking-[0.08em] font-medium text-[var(--color-muted)]">
          Recent activity
        </h2>
        <Table density="compact">
          <thead>
            <tr>
              <th>When</th>
              <th>Event</th>
            </tr>
          </thead>
          <tbody>
            {#each activity.slice(0, 10) as a}
              <tr>
                <td class="text-xs font-mono text-[var(--color-muted)]" style:width="100px">
                  {fmtTs(a.ts)}
                </td>
                <td>
                  <Pill tone="neutral">{a.action}</Pill>
                  <span class="text-xs text-[var(--color-muted)] ml-2 font-mono">{a.detail}</span>
                </td>
              </tr>
            {/each}
          </tbody>
        </Table>
      </section>
    {/if}
  {/if}
</div>
