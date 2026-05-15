<script lang="ts">
  interface Option { value: string; label: string }
  interface Props {
    value: string;
    options: Option[];
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    name?: string;
  }

  let { value = $bindable(), options, placeholder, disabled, required, name }: Props = $props();
</script>

<select
  {name}
  {disabled}
  {required}
  bind:value
  class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-text)] disabled:opacity-50"
>
  {#if placeholder}
    <option value="" disabled>{placeholder}</option>
  {/if}
  {#each options as opt}
    <option value={opt.value}>{opt.label}</option>
  {/each}
</select>
