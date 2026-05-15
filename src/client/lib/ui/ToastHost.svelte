<script lang="ts">
  import { toast } from '$client/lib/toast.svelte';
</script>

<div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end" aria-live="polite">
  {#each toast.items as t (t.id)}
    <div
      class="px-3 py-2 rounded-md text-sm font-medium border min-w-[12rem] max-w-md"
      style:background={
        t.kind === 'success' ? 'var(--color-success-bg)'
        : t.kind === 'error' ? 'var(--color-error-bg)'
        : 'var(--color-info-bg)'
      }
      style:color={
        t.kind === 'success' ? 'var(--color-success-fg)'
        : t.kind === 'error' ? 'var(--color-error-fg)'
        : 'var(--color-info-fg)'
      }
      style:border-color="transparent"
      role="status"
    >
      {t.message}
    </div>
  {/each}
</div>
