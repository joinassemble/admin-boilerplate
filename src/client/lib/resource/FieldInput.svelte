<script lang="ts">
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

  // Coerce to a string for text-based inputs; the parent's onchange callback
  // gets the raw value back through bindable bridges.
  let stringValue = $state<string>(value == null ? '' : String(value));
  let boolValue = $state<boolean>(Boolean(value));

  $effect(() => {
    // Push back to the parent in the type-appropriate shape.
    if (field.type === 'boolean') {
      onchange(boolValue);
    } else if (field.type === 'number' || field.type === 'integer' || field.type === 'currency' || field.type === 'unix-ts') {
      const n = Number(stringValue);
      onchange(Number.isFinite(n) ? n : null);
    } else if (field.type === 'json') {
      try {
        onchange(JSON.parse(stringValue));
      } catch {
        // Leave as the raw string; the server will reject if invalid.
        onchange(stringValue);
      }
    } else {
      onchange(stringValue);
    }
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
