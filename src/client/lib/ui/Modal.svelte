<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    open: boolean;
    onclose?: () => void;
    title?: string;
    children: Snippet;
    footer?: Snippet;
  }

  let { open = $bindable(), onclose, title, children, footer }: Props = $props();

  function close(): void {
    if (onclose) onclose();
    else open = false;
  }

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) close();
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div
    class="fixed inset-0 z-40 grid place-items-center bg-black/40 p-6"
    onclick={handleBackdropClick}
    role="presentation"
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto"
      style:box-shadow="var(--elevation-3)"
      style:animation="modal-in var(--motion-normal) var(--motion-easing)"
    >
      {#if title}
        <header class="px-5 py-4 border-b border-[var(--color-border)]">
          <h2 id="modal-title" class="text-base font-semibold tracking-tight">{title}</h2>
        </header>
      {/if}
      <div class="px-5 py-4">
        {@render children()}
      </div>
      {#if footer}
        <footer class="px-5 py-3 border-t border-[var(--color-border)] flex justify-end gap-2">
          {@render footer()}
        </footer>
      {/if}
    </div>
  </div>
{/if}

<style>
  @keyframes modal-in {
    from { opacity: 0; transform: scale(0.96); }
    to { opacity: 1; transform: scale(1); }
  }
</style>
