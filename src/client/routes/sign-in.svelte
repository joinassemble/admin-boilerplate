<script lang="ts">
  import { api, ApiError } from '$client/lib/api';
  import { push } from 'svelte-spa-router';

  let email = $state('');
  let busy = $state(false);
  let errorMsg = $state<string | null>(null);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    busy = true;
    errorMsg = null;
    try {
      await api('/auth/request', { method: 'POST', body: JSON.stringify({ email }) });
      push('/sign-in-sent');
    } catch (err) {
      errorMsg = err instanceof ApiError ? `Request failed (${err.status})` : 'Request failed';
    } finally {
      busy = false;
    }
  }
</script>

<main class="grid min-h-screen place-items-center px-6">
  <form
    onsubmit={submit}
    class="w-full max-w-sm space-y-5"
    aria-labelledby="sign-in-title"
  >
    <header class="space-y-1">
      <p class="text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)] font-medium">admin-boilerplate</p>
      <h1 id="sign-in-title" class="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p class="text-sm text-[var(--color-muted)]">We'll email you a one-time link.</p>
    </header>

    <label class="block space-y-1">
      <span class="text-xs font-medium text-[var(--color-muted)]">Email</span>
      <input
        type="email"
        autocomplete="email"
        required
        bind:value={email}
        disabled={busy}
        class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-text)]"
      />
    </label>

    {#if errorMsg}
      <p class="text-sm text-[var(--color-error-fg)]">{errorMsg}</p>
    {/if}

    <button
      type="submit"
      disabled={busy || !email}
      class="w-full rounded-md bg-[var(--color-text)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
    >
      {busy ? 'Sending…' : 'Send link'}
    </button>
  </form>
</main>
