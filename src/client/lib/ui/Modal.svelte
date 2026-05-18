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

  let dialogEl: HTMLDivElement | undefined = $state();
  let lastFocus: HTMLElement | null = null;

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

  function handleDialogKeydown(e: KeyboardEvent): void {
    if (e.key !== 'Tab' || !dialogEl) return;
    const focusables = dialogEl.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) {
      // No focusables: keep focus on the dialog itself.
      e.preventDefault();
      dialogEl.focus();
      return;
    }
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && (active === first || active === dialogEl)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  $effect(() => {
    if (open && dialogEl) {
      lastFocus = (document.activeElement as HTMLElement) ?? null;
      // defer one frame so transition starts before focus
      queueMicrotask(() => dialogEl?.focus());
    } else if (!open && lastFocus && document.contains(lastFocus)) {
      lastFocus.focus();
      lastFocus = null;
    }
  });
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div
    class="fixed inset-0 z-40 grid place-items-center p-6"
    style:background-color="var(--color-overlay)"
    onclick={handleBackdropClick}
    role="presentation"
  >
    <div
      bind:this={dialogEl}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      tabindex="-1"
      class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto outline-none"
      style:box-shadow="var(--elevation-3)"
      style:animation="modal-in var(--motion-normal) var(--motion-easing)"
      onkeydown={handleDialogKeydown}
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
  @keyframes -global-modal-in {
    from { opacity: 0; transform: scale(0.96); }
    to { opacity: 1; transform: scale(1); }
  }
</style>
