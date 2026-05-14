<script lang="ts">
  import Router, { push } from 'svelte-spa-router';
  import { onMount } from 'svelte';
  import { session } from '$client/lib/session.svelte';
  import SignIn from './routes/sign-in.svelte';
  import SignInSent from './routes/sign-in-sent.svelte';
  import Home from './routes/home.svelte';

  const routes = {
    '/': Home,
    '/sign-in': SignIn,
    '/sign-in-sent': SignInSent,
    '*': Home,
  };

  onMount(() => {
    void session.load();
  });

  // Auth-aware redirects: as session resolves, push the user to /sign-in or /
  $effect(() => {
    if (session.status === 'anonymous' && !location.hash.startsWith('#/sign-in')) {
      push('/sign-in');
    }
    if (session.status === 'authed' && location.hash.startsWith('#/sign-in')) {
      push('/');
    }
  });
</script>

{#if session.status === 'loading'}
  <main class="grid min-h-screen place-items-center">
    <p class="text-sm text-[var(--color-muted)]">Loading…</p>
  </main>
{:else}
  <Router {routes} />
{/if}
