<script lang="ts">
  let { href = '/', size = 'md' }: { href?: string; size?: 'md' | 'lg' } = $props();
</script>

<a class={['ui-wordmark', size]} {href} aria-label="JNS SPLIT home">
  <span aria-hidden="true">JNS <span class="split">SPLIT</span></span>
</a>

<style>
  .ui-wordmark {
    font: italic 700 1.65rem/1 var(--font-display);
    letter-spacing: 0.04em;
    color: var(--text);
    text-decoration: none;
    white-space: nowrap;
  }
  .lg {
    font-size: 2.5rem;
  }
  .split {
    color: var(--accent-text);
  }
</style>
