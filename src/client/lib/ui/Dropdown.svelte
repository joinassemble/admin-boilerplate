<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';

  interface Props {
    trigger: Snippet<[{ toggle: () => void; isOpen: boolean }]>;
    children: Snippet<[{ close: () => void }]>;
    align?: 'left' | 'right';
  }

  let { trigger, children, align = 'left' }: Props = $props();

  let isOpen = $state(false);
  let rootEl: HTMLDivElement | undefined;

  function toggle(): void { isOpen = !isOpen; }
  function close(): void { isOpen = false; }

  function handleDocumentClick(e: MouseEvent): void {
    if (rootEl && !rootEl.contains(e.target as Node)) close();
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (!isOpen) return;
    if (e.key === 'Escape') close();
  }

  onMount(() => {
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div bind:this={rootEl} class="relative inline-block">
  {@render trigger({ toggle, isOpen })}
  {#if isOpen}
    <div
      role="menu"
      class="absolute top-full mt-1 min-w-[10rem] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md py-1 z-30 {align === 'right' ? 'right-0' : 'left-0'}"
      style:box-shadow="var(--elevation-2)"
    >
      {@render children({ close })}
    </div>
  {/if}
</div>
