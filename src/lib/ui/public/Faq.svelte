<script lang="ts">
  /** Questions and answers as native disclosures: keyboard and screen-reader friendly. */
  let { items }: { items: { q: string; a: string }[] } = $props();
</script>

<div class="faq">
  {#each items as item (item.q)}
    <details>
      <summary>{item.q}</summary>
      <p>{item.a}</p>
    </details>
  {/each}
</div>

<style>
  .faq {
    max-width: 820px;
    border-top: 1px solid var(--edge);
  }
  details {
    margin: 0;
    padding: 0;
    border: 0;
    border-bottom: 1px solid var(--edge);
  }
  summary {
    cursor: pointer;
    list-style: none;
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.1rem 0;
    min-height: var(--touch);
    font-weight: 600;
    font-size: 1.0625rem;
    color: var(--text);
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary::after {
    content: '+';
    font: 700 1.5rem/1 var(--font-display);
    color: var(--muted);
  }
  details[open] summary::after {
    content: '−';
  }
  summary:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }
  p {
    margin: 0;
    padding: 0 0 1.25rem;
    font-size: 1rem;
    line-height: 1.6;
    color: var(--muted);
    max-width: 68ch;
  }
</style>
