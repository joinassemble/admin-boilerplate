<script lang="ts">
  interface Props {
    value: string;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    readonly?: boolean;
    rows?: number;
    name?: string;
  }

  let {
    value = $bindable(),
    placeholder,
    disabled,
    required,
    readonly,
    rows = 4,
    name,
  }: Props = $props();
</script>

<textarea
  {name}
  {disabled}
  {required}
  {readonly}
  {placeholder}
  {rows}
  bind:value
  class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-text)] disabled:opacity-50 read-only:bg-[var(--color-surface-2)] font-sans"
></textarea>
