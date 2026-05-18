<script lang="ts">
  import type { Snippet } from 'svelte';
  interface Props {
    title: string;
    description?: string;
    icon?: string;       // emoji or symbol; default ⌀
    action?: Snippet;    // optional CTA button(s)
  }
  let { title, description, icon = '⌀', action }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center py-12 text-center">
  <div class="text-3xl text-[var(--color-muted)] mb-3" aria-hidden="true">{icon}</div>
  <h3 class="text-base font-semibold tracking-tight">{title}</h3>
  {#if description}
    <p class="text-sm text-[var(--color-muted)] mt-1 max-w-md">{description}</p>
  {/if}
  {#if action}
    <div class="mt-4">{@render action()}</div>
  {/if}
</div>
