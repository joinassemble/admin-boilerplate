<script lang="ts">
  import Pill from '$client/lib/ui/Pill.svelte';
  import type { Field } from '$shared/resource-schema';

  interface Props {
    field: Field;
    value: unknown;
  }

  let { field, value }: Props = $props();

  function formatUnixTs(v: unknown): string {
    if (typeof v !== 'number') return String(v ?? '');
    return new Date(v * 1000).toISOString().slice(0, 10);
  }

  function formatDate(v: unknown): string {
    if (typeof v !== 'string') return '';
    return v.slice(0, 10);
  }

  function formatCurrency(v: unknown): string {
    if (typeof v !== 'number') return String(v ?? '');
    return (v / 100).toFixed(2);
  }
</script>

{#if value === null || value === undefined || value === ''}
  <span class="text-[var(--color-muted)]">—</span>
{:else if field.type === 'boolean'}
  {#if value}<Pill tone="success">true</Pill>{:else}<Pill tone="neutral">false</Pill>{/if}
{:else if field.type === 'unix-ts'}
  <span class="font-mono text-xs">{formatUnixTs(value)}</span>
{:else if field.type === 'date'}
  <span class="font-mono text-xs">{formatDate(value)}</span>
{:else if field.type === 'currency'}
  <span class="font-mono text-xs">{formatCurrency(value)}</span>
{:else if field.type === 'json'}
  <pre class="font-mono text-xs whitespace-pre-wrap break-all text-[var(--color-text-secondary)]">{JSON.stringify(value, null, 2)}</pre>
{:else if field.type === 'url'}
  <a href={String(value)} target="_blank" rel="noopener" class="underline">{String(value)}</a>
{:else if field.type === 'image-url'}
  <img src={String(value)} alt={field.label} class="max-h-12 rounded" />
{:else if field.monospace || (field.type === 'string' && field.primary)}
  <span class="font-mono text-xs">{String(value)}</span>
{:else}
  <span class:font-mono={field.monospace}>{String(value)}</span>
{/if}
