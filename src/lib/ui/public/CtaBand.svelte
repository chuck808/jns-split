<script lang="ts">
  import type { Snippet } from 'svelte';
  /** The lime call-to-action band. Lime with dark text in both themes. */
  let { title, text, actions }: { title: string; text: string; actions: Snippet } = $props();
</script>

<section class="cta-wrap" aria-label={title}>
  <div class="cta">
    <div class="text">
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
    <div class="actions">{@render actions()}</div>
  </div>
</section>

<style>
  .cta-wrap {
    padding: 0 1.5rem 5.5rem;
  }
  .cta {
    max-width: 1200px;
    margin: 0 auto;
    background: #c8ef45;
    color: #0b0f10;
    border-radius: 24px;
    padding: 3.5rem;
    display: flex;
    flex-wrap: wrap;
    gap: 2rem;
    align-items: center;
    justify-content: space-between;
  }
  .text {
    flex: 1 1 480px;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  h2 {
    margin: 0;
    font: italic 800 clamp(2.75rem, 6vw, 4rem) / 0.9 var(--font-display);
    text-transform: uppercase;
    color: #0b0f10;
  }
  p {
    margin: 0;
    font-size: 1.125rem;
    line-height: 1.55;
    max-width: 640px;
    color: #0b0f10;
  }
  .actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .actions :global(a) {
    display: inline-flex;
    align-items: center;
    min-height: 52px;
    padding: 0 1.5rem;
    border-radius: 12px;
    background: #0b0f10;
    color: #eef2f3;
    font-weight: 600;
    text-decoration: none;
  }
  .actions :global(a:hover) {
    background: #1c2528;
    color: #ffffff;
  }
  .actions :global(a:focus-visible) {
    outline: 3px solid #0b0f10;
    outline-offset: 3px;
  }
  @media (max-width: 640px) {
    .cta-wrap {
      padding: 0 1rem 3.5rem;
    }
    .cta {
      padding: 2rem 1.5rem;
    }
  }
</style>
