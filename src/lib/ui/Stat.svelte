<script lang="ts">
  import type { Snippet } from 'svelte';
  let {
    label,
    value,
    hint,
    children
  }: { label: string; value: string | number; hint?: string; children?: Snippet } = $props();
</script>

<div class="ui-stat">
  <span class="label">{label}</span>
  <span class="value tabular">{value}</span>
  {#if hint}<span class="hint">{hint}</span>{/if}
  {#if children}{@render children()}{/if}
</div>

<style>
  .ui-stat {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }
  .label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--muted);
  }
  .value {
    font: 700 2.75rem/1 var(--font-display);
  }
  .hint {
    font-size: 0.875rem;
    color: var(--muted);
  }
</style>
