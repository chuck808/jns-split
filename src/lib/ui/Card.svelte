<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title,
    tone = 'default',
    span = 1,
    actions,
    children
  }: {
    /** Card heading, rendered as an h2 and used to label the section. */
    title?: string;
    tone?: 'default' | 'highlight' | 'warn';
    /** Grid columns to span inside a CardGrid. */
    span?: 1 | 2 | 3;
    actions?: Snippet;
    children: Snippet;
  } = $props();

  const id = $props.id();
</script>

<section
  class={['ui-card', tone]}
  style:grid-column={span > 1 ? `span ${span}` : undefined}
  aria-labelledby={title ? id : undefined}
>
  {#if title || actions}
    <div class="head">
      {#if title}<h2 {id}>{title}</h2>{/if}
      {#if actions}<div class="actions">{@render actions()}</div>{/if}
    </div>
  {/if}
  {@render children()}
</section>

<style>
  .ui-card {
    background: var(--surface);
    border: 1px solid var(--edge);
    border-radius: var(--radius-lg);
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
  }
  .highlight {
    border-color: var(--accent-edge);
  }
  .warn {
    border-color: var(--warn-edge);
    background: var(--warn-soft);
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  h2 {
    margin: 0;
    font-size: 1.375rem;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    font-size: 0.875rem;
    font-weight: 600;
  }
  .ui-card :global(p) {
    margin: 0;
  }
  @media (max-width: 860px) {
    .ui-card {
      grid-column: auto !important;
    }
  }
</style>
