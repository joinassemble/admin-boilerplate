<script lang="ts">
  import type { Snippet } from 'svelte';
  import DefaultTopbarRight from './DefaultTopbarRight.svelte';
  import DefaultSidebar from './DefaultSidebar.svelte';

  interface Props {
    leftRail?: Snippet;
    topbarLeft?: Snippet;
    topbarCenter?: Snippet;
    topbarRight?: Snippet;
    subnav?: Snippet;
    sidebar?: Snippet;
    main?: Snippet;
    aside?: Snippet;
    children?: Snippet;  // fallback for main
  }

  let {
    leftRail,
    topbarLeft,
    topbarCenter,
    topbarRight,
    subnav,
    sidebar,
    main,
    aside,
    children,
  }: Props = $props();
</script>

<div
  class="grid min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]"
  style:grid-template-columns="auto auto 1fr auto"
  style:grid-template-rows="auto auto 1fr"
  style:grid-template-areas={`
    "rail topbar topbar topbar"
    "rail subnav subnav subnav"
    "rail sidebar main aside"
  `}
>
  <!-- Left rail (optional) -->
  {#if leftRail}
    <aside style:grid-area="rail" class="border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      {@render leftRail()}
    </aside>
  {/if}

  <!-- Topbar -->
  <header
    style:grid-area="topbar"
    class="h-12 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center px-4 gap-4"
  >
    <div class="flex items-center gap-3 min-w-[12rem]">
      {#if topbarLeft}{@render topbarLeft()}{/if}
    </div>
    <div class="flex-1 flex items-center justify-center">
      {#if topbarCenter}{@render topbarCenter()}{/if}
    </div>
    <div class="flex items-center gap-2 min-w-[12rem] justify-end">
      {#if topbarRight}{@render topbarRight()}{:else}<DefaultTopbarRight />{/if}
    </div>
  </header>

  <!-- Subnav (optional) -->
  {#if subnav}
    <nav style:grid-area="subnav" class="h-10 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center px-4">
      {@render subnav()}
    </nav>
  {/if}

  <!-- Sidebar -->
  <aside
    style:grid-area="sidebar"
    class="w-56 border-r border-[var(--color-border)] bg-[var(--color-surface)] overflow-y-auto"
  >
    {#if sidebar}{@render sidebar()}{:else}<DefaultSidebar />{/if}
  </aside>

  <!-- Main -->
  <main style:grid-area="main" class="overflow-y-auto p-6">
    {#if main}{@render main()}{:else if children}{@render children()}{/if}
  </main>

  <!-- Aside (optional) -->
  {#if aside}
    <section style:grid-area="aside" class="w-72 border-l border-[var(--color-border)] bg-[var(--color-surface)] overflow-y-auto">
      {@render aside()}
    </section>
  {/if}
</div>
