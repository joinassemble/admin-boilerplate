<script lang="ts">
  import { onMount } from 'svelte';
  import { push } from 'svelte-spa-router';
  import { api, ApiError } from '$client/lib/api';
  import { toast } from '$client/lib/toast.svelte';
  import Button from '$client/lib/ui/Button.svelte';
  import Field from '$client/lib/ui/Field.svelte';
  import FieldInput from './FieldInput.svelte';
  import type { Resource } from '$shared/resource-schema';

  interface Props {
    resource: Resource;
    /** If present, this is an edit; otherwise it's a create. */
    recordId?: string;
  }

  let { resource, recordId }: Props = $props();

  let values = $state<Record<string, unknown>>({});
  let loading = $state(false);
  let saving = $state(false);
  let errorMsg = $state<string | null>(null);

  const editableFields = $derived(
    resource.fields.filter((f) => (recordId ? f.editable : !f.readOnly) && !f.primary),
  );

  async function loadExisting() {
    if (!recordId) return;
    loading = true;
    try {
      values = await api<Record<string, unknown>>(
        `/api/resources/${resource.id}/detail/${encodeURIComponent(recordId)}`,
      );
    } catch (err) {
      errorMsg = err instanceof ApiError ? `Failed to load (${err.status})` : 'Failed to load';
    } finally {
      loading = false;
    }
  }

  onMount(loadExisting);

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (saving) return;
    saving = true;
    errorMsg = null;
    try {
      if (recordId) {
        await api(`/api/resources/${resource.id}/${encodeURIComponent(recordId)}`, {
          method: 'PATCH',
          body: JSON.stringify(values),
        });
        toast.success('Saved');
        push(`/r/${resource.id}/${recordId}`);
      } else {
        await api<Record<string, unknown>>(`/api/resources/${resource.id}`, {
          method: 'POST',
          body: JSON.stringify(values),
        });
        toast.success('Created');
        // After create, redirect to the LIST rather than the new detail page.
        // Reasoning: a freshly-issued id from the upstream may not be loadable
        // yet (e.g. JSONPlaceholder fakes the POST → returns id 101 → real GET
        // for /posts/101 then 404s). The list view is always loadable, and
        // for real backends the new row will typically appear at the top.
        push(`/r/${resource.id}`);
      }
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      errorMsg = `Save failed (${status || 'network'})`;
      toast.error(errorMsg);
    } finally {
      saving = false;
    }
  }
</script>

<div class="space-y-4">
  <header class="flex items-baseline justify-between">
    <h1 class="text-xl font-semibold tracking-tight">
      {recordId ? `Edit ${resource.name}` : `New ${resource.name}`}
    </h1>
  </header>

  {#if loading}
    <p class="text-sm text-[var(--color-muted)]">Loading…</p>
  {:else}
    <form onsubmit={submit} class="space-y-4 max-w-xl">
      {#each editableFields as f}
        <Field label={f.label} required={f.required}>
          <FieldInput
            field={f}
            value={values[f.key]}
            disabled={saving || f.readOnly}
            onchange={(v) => { values = { ...values, [f.key]: v }; }}
          />
        </Field>
      {/each}

      {#if errorMsg}
        <p class="text-sm text-[var(--color-error-fg)]">{errorMsg}</p>
      {/if}

      <div class="flex items-center gap-2">
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : recordId ? 'Save' : 'Create'}</Button>
        <Button
          type="button"
          variant="ghost"
          onclick={() => push(recordId ? `/r/${resource.id}/${recordId}` : `/r/${resource.id}`)}
        >
          Cancel
        </Button>
      </div>
    </form>
  {/if}
</div>
