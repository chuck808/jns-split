<script lang="ts">
  import { page } from '$app/state';
  import ThemeSelector from '#lib/components/ThemeSelector.svelte';
  import Wordmark from './Wordmark.svelte';

  let { theme = 'system' }: { theme?: string } = $props();
  const links = [
    ['/about', 'About'],
    ['/help', 'Help'],
    ['/contact', 'Contact']
  ];
</script>

<header class="site-header">
  <Wordmark />
  <nav aria-label="Site">
    {#each links as [href, label] (href)}
      <a {href} aria-current={page.url.pathname === href ? 'page' : undefined}>{label}</a>
    {/each}
  </nav>
  <div class="theme"><ThemeSelector value={theme} /></div>
  <a class="open" href="/app">Open JNS SPLIT</a>
</header>

<style>
  .site-header {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    flex-wrap: wrap;
    padding: 0.75rem 1.5rem;
    border-bottom: 1px solid var(--edge);
    background: var(--bg);
  }
  nav {
    display: flex;
    gap: 0.25rem;
    flex: 1;
  }
  nav a {
    display: inline-flex;
    align-items: center;
    min-height: var(--touch);
    padding: 0 0.75rem;
    border-radius: var(--radius-sm);
    color: var(--muted);
    text-decoration: none;
    font-weight: 500;
  }
  nav a:hover,
  nav a[aria-current='page'] {
    color: var(--text);
    background: var(--raised);
  }
  .open {
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    min-height: var(--touch);
    padding: 0 1rem;
    border-radius: 10px;
    background: var(--accent);
    color: var(--on-accent);
    font-weight: 600;
    text-decoration: none;
  }
  .open:hover {
    background: var(--accent-hover);
    color: var(--on-accent);
  }
  @media (max-width: 720px) {
    .site-header {
      gap: 0.5rem 1rem;
      padding: 0.75rem 1rem;
    }
    .open {
      margin-left: auto;
    }
    nav {
      order: 3;
      flex: 1;
    }
    nav a {
      padding: 0 0.5rem;
    }
    .theme {
      order: 4;
    }
  }
</style>
