<script lang="ts">
  interface Props {
    type?: 'text' | 'email' | 'url' | 'number' | 'password' | 'search';
    value: string | number | undefined;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    readonly?: boolean;
    monospace?: boolean;
    name?: string;
    autocomplete?: string;
    oninput?: (e: Event) => void;
  }

  let {
    type = 'text',
    value = $bindable(),
    placeholder,
    disabled,
    required,
    readonly,
    monospace,
    name,
    autocomplete,
    oninput,
  }: Props = $props();
</script>

<input
  {name}
  {type}
  {disabled}
  {required}
  {readonly}
  {placeholder}
  {autocomplete}
  bind:value
  {oninput}
  class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-text)] disabled:opacity-50 read-only:bg-[var(--color-surface-2)]"
  class:font-mono={monospace}
/>
