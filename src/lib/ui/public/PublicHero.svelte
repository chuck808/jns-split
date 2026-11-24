<script lang="ts">
  import type { Snippet } from 'svelte';
  /**
   * The dark, sporty band at the top of each public page. It stays dark in
   * both themes, like the scoreboard it sits beside.
   * Links inside `actions`: the first is the lime primary, the rest are outlined.
   */
  let {
    eyebrow,
    title,
    lead,
    actions,
    aside,
    compact = false
  }: {
    eyebrow?: string;
    title: string;
    lead?: string;
    actions?: Snippet;
    aside?: Snippet;
    compact?: boolean;
  } = $props();
</script>

<section class={['hero', compact && 'compact', aside && 'split']}>
  <div class="stripes" aria-hidden="true">
    <span></span><span></span><span></span><span></span>
  </div>
  <div class="inner">
    <div class="copy">
      {#if eyebrow}<p class="eyebrow-label">{eyebrow}</p>{/if}
      <h1>{title}</h1>
      {#if lead}<p class="lead">{lead}</p>{/if}
      {#if actions}<div class="actions">{@render actions()}</div>{/if}
    </div>
    {#if aside}<div class="aside">{@render aside()}</div>{/if}
  </div>
</section>

<style>
  .hero {
    position: relative;
    background: #0b0f10;
    color: #eef2f3;
    padding: 5.5rem 1.5rem 6rem;
    overflow: hidden;
  }
  .compact {
    padding: 4rem 1.5rem 4.25rem;
  }
  .stripes {
    position: absolute;
    inset: 0 0 auto 0;
    display: flex;
    height: 6px;
  }
  .stripes span {
    flex: 1;
  }
  .stripes span:nth-child(1) {
    background: var(--lane-1);
  }
  .stripes span:nth-child(2) {
    background: var(--lane-2);
  }
  .stripes span:nth-child(3) {
    background: var(--lane-3);
  }
  .stripes span:nth-child(4) {
    background: var(--lane-4);
  }
  .inner {
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 3.5rem;
    align-items: center;
  }
  .split .inner {
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  }
  .copy {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 760px;
  }
  .eyebrow-label {
    margin: 0;
    font: 600 0.875rem var(--font-body);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #c8ef45;
  }
  h1 {
    margin: 0;
    font: italic 800 clamp(3.5rem, 8vw, 6.5rem) / 0.86 var(--font-display);
    text-transform: uppercase;
    letter-spacing: -0.01em;
    color: #eef2f3;
  }
  .compact h1 {
    font-size: clamp(3rem, 6.5vw, 5rem);
  }
  .lead {
    margin: 0;
    font-size: 1.25rem;
    line-height: 1.55;
    color: #a3b1b7;
    max-width: 600px;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding-top: 0.5rem;
  }
  .actions :global(a) {
    display: inline-flex;
    align-items: center;
    min-height: 52px;
    padding: 0 1.5rem;
    border-radius: 12px;
    border: 1px solid #3a474c;
    color: #eef2f3;
    font-weight: 600;
    font-size: 1.0625rem;
    text-decoration: none;
  }
  .actions :global(a:hover) {
    border-color: #a3b1b7;
    color: #ffffff;
  }
  .actions :global(a:first-child) {
    background: #c8ef45;
    border-color: #c8ef45;
    color: #0b0f10;
  }
  .actions :global(a:first-child:hover) {
    background: #d8f76f;
    color: #0b0f10;
  }
  .actions :global(a:focus-visible) {
    outline: 3px solid #c8ef45;
    outline-offset: 3px;
  }
  @media (max-width: 960px) {
    .split .inner {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (max-width: 640px) {
    .hero {
      padding: 3.5rem 1rem 4rem;
    }
    .compact {
      padding: 3rem 1rem;
    }
    .lead {
      font-size: 1.0625rem;
    }
    .actions :global(a) {
      flex: 1 1 auto;
      justify-content: center;
    }
  }
</style>
