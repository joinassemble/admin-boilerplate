<script lang="ts">
  import { link, router } from 'svelte-spa-router';
  import { registry } from '$client/lib/registry.svelte';

  // Active match — svelte-spa-router v5 exposes router.location (no leading '/').
  function isActive(href: string): boolean {
    return router.location === href || router.location.startsWith(href + '/');
  }
</script>

<nav class="p-4 space-y-4">
  <a
    href="/"
    use:link
    class="block text-[11px] uppercase tracking-[0.08em] font-medium text-[var(--color-muted)] hover:text-[var(--color-text)]"
  >
    admin-boilerplate
  </a>

  {#if registry.status === 'loading'}
    <p class="text-xs text-[var(--color-muted)]">Loading…</p>
  {:else if registry.status === 'error'}
    <p class="text-xs text-[var(--color-error-fg)]">Couldn't load resources.</p>
  {:else if registry.status === 'ready'}
    {@const groups = registry.grouped()}
    {#each Object.entries(groups) as [group, resources]}
      <div>
        <div class="text-[10px] uppercase tracking-[0.08em] text-[var(--color-muted)] font-medium px-2 mb-1">
          {group}
        </div>
        <ul class="space-y-0.5">
          {#each resources as r (r.id)}
            {@const href = `/r/${r.id}`}
            <li>
              <a
                href={href}
                use:link
                class="block px-2 py-1 rounded text-sm hover:bg-[var(--color-surface-2)] {isActive(href) ? 'bg-[var(--color-surface-2)] font-medium' : 'text-[var(--color-text-secondary)]'}"
              >
                {r.name}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  {/if}
</nav>
