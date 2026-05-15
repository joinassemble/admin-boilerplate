<script lang="ts">
  import { untrack } from 'svelte';
  import Input from '$client/lib/ui/Input.svelte';
  import Textarea from '$client/lib/ui/Textarea.svelte';
  import Select from '$client/lib/ui/Select.svelte';
  import Checkbox from '$client/lib/ui/Checkbox.svelte';
  import type { Field } from '$shared/resource-schema';

  interface Props {
    field: Field;
    value: unknown;
    onchange: (newValue: unknown) => void;
    disabled?: boolean;
  }

  let { field, value, onchange, disabled = false }: Props = $props();

  // Local edit state for text-based inputs.
  let stringValue = $state<string>(value == null ? '' : String(value));
  let boolValue = $state<boolean>(Boolean(value));

  // Push local edits back to the parent.
  //
  // Why `untrack` around the `onchange(...)` call: in Svelte 5, props read
  // inside an `$effect` are tracked dependencies. The parent's onchange is
  // an arrow function created fresh on every render, so its identity changes
  // every time the parent re-renders (e.g. when WE call onchange and the
  // parent updates `values`). Without untrack, that creates a loop:
  //   onchange → parent update → new arrow → effect re-runs → onchange → ...
  // → `effect_update_depth_exceeded`.
  // We only want this effect to re-fire on local state changes
  // (stringValue / boolValue), not on parent-identity churn.
  $effect(() => {
    // Tracked reads — these decide when the effect re-runs.
    const bv = boolValue;
    const sv = stringValue;

    // Compute the value to push, then call onchange in an untracked block.
    let next: unknown;
    if (field.type === 'boolean') {
      next = bv;
    } else if (
      field.type === 'number' ||
      field.type === 'integer' ||
      field.type === 'currency' ||
      field.type === 'unix-ts'
    ) {
      const n = Number(sv);
      next = Number.isFinite(n) ? n : null;
    } else if (field.type === 'json') {
      try {
        next = JSON.parse(sv);
      } catch {
        next = sv;
      }
    } else {
      next = sv;
    }

    untrack(() => onchange(next));
  });
</script>

{#if field.type === 'boolean'}
  <Checkbox bind:checked={boolValue} {disabled} />
{:else if field.type === 'enum' && field.enumOptions}
  <Select bind:value={stringValue} options={field.enumOptions} {disabled} />
{:else if field.type === 'text' || field.type === 'json'}
  <Textarea bind:value={stringValue} {disabled} readonly={field.readOnly} required={field.required} />
{:else if field.type === 'email'}
  <Input type="email" bind:value={stringValue} {disabled} readonly={field.readOnly} required={field.required} />
{:else if field.type === 'url' || field.type === 'image-url'}
  <Input type="url" bind:value={stringValue} {disabled} readonly={field.readOnly} required={field.required} />
{:else if field.type === 'number' || field.type === 'integer' || field.type === 'currency' || field.type === 'unix-ts'}
  <Input type="number" bind:value={stringValue} {disabled} readonly={field.readOnly} required={field.required} />
{:else if field.type === 'date'}
  <Input type="text" bind:value={stringValue} placeholder="YYYY-MM-DD" {disabled} readonly={field.readOnly} required={field.required} />
{:else}
  <Input type="text" bind:value={stringValue} {disabled} readonly={field.readOnly} required={field.required} monospace={field.monospace} />
{/if}
