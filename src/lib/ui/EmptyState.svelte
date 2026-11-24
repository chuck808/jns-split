<script lang="ts">
  import type { Snippet } from 'svelte';
  let { title, children, action }: { title: string; children?: Snippet; action?: Snippet } =
    $props();
</script>

<div class="ui-empty">
  <p class="title">{title}</p>
  {#if children}<div class="body">{@render children()}</div>{/if}
  {#if action}<div class="action">{@render action()}</div>{/if}
</div>

<style>
  .ui-empty {
    border: 1px dashed var(--edge-strong);
    border-radius: var(--radius);
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .title {
    margin: 0;
    font-weight: 600;
    color: var(--text);
  }
  .body {
    color: var(--muted);
    font-size: 0.9375rem;
  }
  .body :global(p) {
    margin: 0;
  }
</style>
