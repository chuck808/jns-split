<script lang="ts">
  import type { Snippet } from 'svelte';
  /** A full-width band of a public page with a centred content column. */
  let {
    id,
    eyebrow,
    title,
    lead,
    tone = 'plain',
    children
  }: {
    id?: string;
    eyebrow?: string;
    title?: string;
    lead?: string;
    tone?: 'plain' | 'raised';
    children?: Snippet;
  } = $props();
  const headingId = $props.id();
</script>

<section {id} class={['pub-section', tone]} aria-labelledby={title ? headingId : undefined}>
  <div class="inner">
    {#if eyebrow || title || lead}
      <div class="head">
        {#if eyebrow}<p class="eyebrow-label">{eyebrow}</p>{/if}
        {#if title}<h2 id={headingId}>{title}</h2>{/if}
        {#if lead}<p class="lead">{lead}</p>{/if}
      </div>
    {/if}
    {#if children}{@render children()}{/if}
  </div>
</section>

<style>
  .pub-section {
    padding: 5.5rem 1.5rem;
    scroll-margin-top: 1rem;
  }
  .raised {
    background: var(--sidebar);
    border-top: 1px solid var(--edge);
    border-bottom: 1px solid var(--edge);
  }
  .inner {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
  }
  .head {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 760px;
  }
  .eyebrow-label {
    margin: 0;
    font: 600 0.875rem var(--font-body);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  h2 {
    margin: 0;
    font-size: clamp(2.5rem, 5vw, 3.5rem);
    line-height: 0.95;
  }
  .lead {
    margin: 0;
    font-size: 1.125rem;
    line-height: 1.6;
    color: var(--muted);
  }
  @media (max-width: 640px) {
    .pub-section {
      padding: 3.5rem 1rem;
    }
    .inner {
      gap: 1.75rem;
    }
  }
</style>
