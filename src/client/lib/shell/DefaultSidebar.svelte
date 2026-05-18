<script lang="ts">
  import { link, router } from 'svelte-spa-router';
  import { registry } from '$client/lib/registry.svelte';
  import { session } from '$client/lib/session.svelte';

  // Active match — svelte-spa-router v5 exposes router.location (no leading '/').
  function isActive(href: string): boolean {
    return router.location === href || router.location.startsWith(href + '/');
  }

  const settingsItems = [
    { href: '/settings/connections', label: 'Connections' },
    { href: '/settings/access',      label: 'Access' },
    { href: '/settings/users',       label: 'Users' },
    { href: '/settings/audit',       label: 'Audit' },
    { href: '/design',               label: 'Design system' },
  ];
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

  {#if session.value?.role === 'admin'}
    <div>
      <div class="text-[10px] uppercase tracking-[0.08em] text-[var(--color-muted)] font-medium px-2 mb-1">
        Settings
      </div>
      <ul class="space-y-0.5">
        {#each settingsItems as item}
          <li>
            <a
              href={item.href}
              use:link
              class="block px-2 py-1 rounded text-sm hover:bg-[var(--color-surface-2)] {isActive(item.href) ? 'bg-[var(--color-surface-2)] font-medium' : 'text-[var(--color-text-secondary)]'}"
            >
              {item.label}
            </a>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</nav>
