<script lang="ts">
  import { onMount } from 'svelte';
  import IconButton from '$client/lib/ui/IconButton.svelte';
  import { session } from '$client/lib/session.svelte';
  import { theme } from '$client/lib/theme.svelte';

  onMount(() => theme.apply());
  $effect(() => { theme.apply(); });

  function themeLabel(): string {
    if (theme.choice === 'light') return 'Light';
    if (theme.choice === 'dark') return 'Dark';
    return 'System';
  }

  function themeIcon(): string {
    if (theme.resolved === 'dark') return '◐';
    return '◑';
  }
</script>

<div class="flex items-center gap-1">
  <IconButton ariaLabel={`Theme: ${themeLabel()}, click to cycle`} onclick={() => theme.cycle()}>
    <span aria-hidden="true">{themeIcon()}</span>
  </IconButton>

  {#if session.value}
    <span class="text-xs text-[var(--color-muted)] px-2" title={session.value.email}>
      {session.value.email}
    </span>
    <IconButton ariaLabel="Sign out" onclick={() => session.signOut()}>
      <span aria-hidden="true">⇥</span>
    </IconButton>
  {/if}
</div>
