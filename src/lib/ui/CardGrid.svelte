<script lang="ts">
  import type { Snippet } from 'svelte';
  let { columns = 3, children }: { columns?: 1 | 2 | 3 | 4; children: Snippet } = $props();
</script>

<div class="ui-grid" style:--columns={columns}>{@render children()}</div>

<style>
  .ui-grid {
    display: grid;
    grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
    gap: 1rem;
  }
  @media (max-width: 860px) {
    .ui-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
