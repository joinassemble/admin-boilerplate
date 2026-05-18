<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Tab {
    key: string;
    label: string;
    content: Snippet;
  }

  interface Props {
    tabs: Tab[];
    activeKey?: string;
  }

  let { tabs, activeKey = $bindable(tabs[0]?.key ?? '') }: Props = $props();

  const activeTab = $derived(tabs.find((t) => t.key === activeKey) ?? tabs[0]);
</script>

<div class="space-y-4">
  <div class="border-b border-[var(--color-border)] flex gap-4" role="tablist">
    {#each tabs as t}
      <button
        type="button"
        role="tab"
        aria-selected={t.key === activeKey}
        onclick={() => (activeKey = t.key)}
        class="pb-2 px-1 text-sm border-b-2 transition-colors focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 {t.key === activeKey ? 'border-[var(--color-text)] text-[var(--color-text)] font-medium' : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'}"
        style:outline-color="var(--focus-ring-color)"
        style:transition-duration="var(--motion-fast)"
      >
        {t.label}
      </button>
    {/each}
  </div>
  {#if activeTab}
    {@render activeTab.content()}
  {/if}
</div>
