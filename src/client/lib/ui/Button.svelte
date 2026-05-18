<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'sm' | 'md';
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
  }

  let {
    variant = 'primary',
    size = 'md',
    type = 'button',
    disabled = false,
    onclick,
    children,
  }: Props = $props();

  const base = 'inline-flex items-center justify-center font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
  const sizes = { sm: 'px-2.5 py-1 text-xs', md: 'px-3 py-2 text-sm' };
  const variants = {
    primary: 'bg-[var(--color-text)] text-[var(--color-bg)] hover:opacity-90',
    secondary: 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-2)]',
    ghost: 'text-[var(--color-text)] hover:bg-[var(--color-surface-2)]',
  };
</script>

<button
  {type}
  {disabled}
  {onclick}
  class="{base} {sizes[size]} {variants[variant]}"
  style:outline-color="var(--focus-ring-color)"
  style:transition="background-color var(--motion-fast) var(--motion-easing), color var(--motion-fast) var(--motion-easing), opacity var(--motion-fast) var(--motion-easing)"
>
  {@render children()}
</button>
