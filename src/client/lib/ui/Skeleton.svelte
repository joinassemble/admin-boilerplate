<script lang="ts">
  interface Props {
    width?: string;
    height?: string;
    rounded?: 'sm' | 'md' | 'full';
  }
  let { width = '100%', height = '1em', rounded = 'sm' }: Props = $props();
  const radius = rounded === 'full' ? '999px' : rounded === 'md' ? 'var(--radius-md)' : 'var(--radius-sm)';
</script>

<span
  class="inline-block bg-[var(--color-surface-2)] animate-pulse"
  style:width
  style:height
  style:border-radius={radius}
></span>

<style>
  @keyframes pulse { 50% { opacity: 0.5; } }
  .animate-pulse { animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
</style>
