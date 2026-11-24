<script lang="ts">
  import Wordmark from '../Wordmark.svelte';
</script>

<footer class="site-footer">
  <div class="inner">
    <div class="brand">
      <Wordmark />
      <span>Sports timing for clubs. In a pilot with BMX clubs.</span>
    </div>
    <nav aria-label="Footer">
      <a href="/about">About</a>
      <a href="/help">Help</a>
      <a href="/contact">Contact</a>
      <a href="/clubs/request">Register your club</a>
      <a href="/bench">Bench simulator</a>
    </nav>
  </div>
</footer>

<style>
  .site-footer {
    border-top: 1px solid var(--edge);
    padding: 2rem 1.5rem 2.5rem;
  }
  .inner {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
    justify-content: space-between;
    align-items: flex-start;
  }
  .brand {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--muted);
  }
  nav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1.25rem;
  }
  nav a {
    display: inline-flex;
    align-items: center;
    min-height: var(--touch);
    font-size: 0.9375rem;
    color: var(--muted);
    text-decoration: none;
  }
  nav a:hover {
    color: var(--text);
    text-decoration: underline;
  }
</style>
