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
    error?: boolean;
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
    error = false,
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
  class="w-full rounded-md border bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none disabled:opacity-50 read-only:bg-[var(--color-surface-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 {error ? 'border-[var(--color-error-fg)]' : 'border-[var(--color-border)]'}"
  class:font-mono={monospace}
  style:outline-color={error ? 'var(--color-error-fg)' : 'var(--focus-ring-color)'}
  style:transition="border-color var(--motion-fast) var(--motion-easing)"
/>
