<script lang="ts">
  import Router, { push } from 'svelte-spa-router';
  import { onMount } from 'svelte';
  import { session } from '$client/lib/session.svelte';
  import { registry } from '$client/lib/registry.svelte';
  import { theme } from '$client/lib/theme.svelte';
  import AppShell from '$client/lib/shell/AppShell.svelte';
  import ToastHost from '$client/lib/ui/ToastHost.svelte';

  import SignIn from './routes/sign-in.svelte';
  import SignInSent from './routes/sign-in-sent.svelte';
  import Home from './routes/home.svelte';
  import ResourceListPage from './routes/ResourceListPage.svelte';
  import ResourceDetailPage from './routes/ResourceDetailPage.svelte';
  import ResourceFormPage from './routes/ResourceFormPage.svelte';
  import SettingsConnectionsPage from './routes/SettingsConnectionsPage.svelte';
  import SettingsAccessPage from './routes/SettingsAccessPage.svelte';
  import SettingsUsersPage from './routes/SettingsUsersPage.svelte';
  import SettingsAuditPage from './routes/SettingsAuditPage.svelte';
  import DesignShowcasePage from './routes/DesignShowcasePage.svelte';

  const authedRoutes = {
    '/': Home,
    '/r/:id': ResourceListPage,
    '/r/:id/new': ResourceFormPage,
    '/r/:id/:recordId': ResourceDetailPage,
    '/r/:id/:recordId/edit': ResourceFormPage,
    '/settings/connections': SettingsConnectionsPage,
    '/settings/access': SettingsAccessPage,
    '/settings/users': SettingsUsersPage,
    '/settings/audit': SettingsAuditPage,
    '/design': DesignShowcasePage,
    '*': Home,
  };

  const unauthedRoutes = {
    '/sign-in': SignIn,
    '/sign-in-sent': SignInSent,
    '*': SignIn,
  };

  onMount(() => {
    void session.load();
    theme.apply();
  });

  $effect(() => { theme.apply(); });

  $effect(() => {
    // Auth-aware redirects.
    if (session.status === 'anonymous' && !location.hash.startsWith('#/sign-in')) {
      push('/sign-in');
    }
    if (session.status === 'authed' && location.hash.startsWith('#/sign-in')) {
      push('/');
    }
  });

  $effect(() => {
    // Load the resource registry once we're signed in.
    if (session.status === 'authed' && registry.status === 'idle') {
      void registry.load();
    }
  });
</script>

{#if session.status === 'loading'}
  <main class="grid min-h-screen place-items-center">
    <p class="text-sm text-[var(--color-muted)]">Loading…</p>
  </main>
{:else if session.status === 'anonymous'}
  <Router routes={unauthedRoutes} />
{:else}
  <AppShell>
    {#snippet main()}
      <Router routes={authedRoutes} />
    {/snippet}
  </AppShell>
{/if}

<ToastHost />
