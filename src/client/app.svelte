<script lang="ts">
  let now = $state(new Date().toISOString());
  $effect(() => {
    const interval = setInterval(() => { now = new Date().toISOString(); }, 1000);
    return () => clearInterval(interval);
  });
</script>

<main class="grid min-h-screen place-items-center">
  <div class="text-center">
    <p class="text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)] font-medium">
      admin-boilerplate
    </p>
    <h1 class="mt-2 text-3xl font-semibold tracking-tight">Hello.</h1>
    <p class="mt-1 text-sm text-[var(--color-muted)]">{now}</p>
  </div>
</main>
