<script lang="ts">
  interface Props {
    checked: boolean;
    disabled?: boolean;
    name?: string;
    label?: string;
  }

  let { checked = $bindable(), disabled, name, label }: Props = $props();
</script>

<label class="inline-flex items-center gap-2 text-sm text-[var(--color-text)] cursor-pointer">
  <input
    {name}
    {disabled}
    type="checkbox"
    bind:checked
    class="rounded border-[var(--color-border-strong)]"
  />
  {#if label}<span>{label}</span>{/if}
</label>
