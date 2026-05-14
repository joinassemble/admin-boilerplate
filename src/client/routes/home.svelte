<script lang="ts">
  import { session } from '$client/lib/session.svelte';
</script>

<main class="grid min-h-screen place-items-center px-6">
  <div class="w-full max-w-sm text-center space-y-3">
    <p class="text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)] font-medium">admin-boilerplate</p>
    <h1 class="text-2xl font-semibold tracking-tight">Signed in.</h1>
    <p class="text-sm text-[var(--color-muted)]">{session.value?.email}</p>
    <button
      type="button"
      onclick={() => session.signOut()}
      class="text-sm text-[var(--color-muted)] underline-offset-2 hover:underline"
    >
      Sign out
    </button>
  </div>
</main>
