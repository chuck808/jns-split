<script lang="ts">
  import type { Snippet } from 'svelte';
  let {
    eyebrow,
    title,
    description,
    actions
  }: { eyebrow?: string; title: string; description?: string; actions?: Snippet } = $props();
</script>

<header class="ui-page-header">
  <div class="text">
    {#if eyebrow}<p class="eyebrow-text">{eyebrow}</p>{/if}
    <h1>{title}</h1>
    {#if description}<p class="description">{description}</p>{/if}
  </div>
  {#if actions}<div class="actions">{@render actions()}</div>{/if}
</header>

<style>
  .ui-page-header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-end;
    gap: 1rem;
  }
  .text {
    min-width: 0;
    flex: 1 1 320px;
  }
  .eyebrow-text {
    margin: 0;
    font-size: 0.875rem;
    color: var(--muted);
  }
  h1 {
    margin: 0.15rem 0 0;
  }
  .description {
    margin: 0.5rem 0 0;
    max-width: 62ch;
  }
  .actions {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
</style>
