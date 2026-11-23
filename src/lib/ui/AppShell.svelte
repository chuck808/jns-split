<script lang="ts">
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';
  import type { ShellData } from '#lib/workspaces';
  import AccountMenu from './AccountMenu.svelte';
  import Wordmark from './Wordmark.svelte';
  import type { NavItem } from './types';

  let {
    shell,
    theme = 'system',
    area,
    nav = [],
    homeHref = '/app',
    children
  }: {
    shell: ShellData;
    theme?: string;
    /** Accessible name for the sidebar navigation, e.g. "Club". */
    area: string;
    nav?: NavItem[];
    homeHref?: string;
    children: Snippet;
  } = $props();

  function isCurrent(item: NavItem) {
    const path = page.url.pathname;
    return path === item.href || (!!item.prefix && path.startsWith(item.href + '/'));
  }
</script>

<div class="ui-shell">
  <aside class="sidebar">
    <div class="brand"><Wordmark href={homeHref} /></div>
    <AccountMenu {shell} {theme} />
    {#if nav.length}
      <nav aria-label={area}>
        <ul>
          {#each nav as item (item.href)}
            {@const current = isCurrent(item)}
            <li>
              <a href={item.href} class:current aria-current={current ? 'page' : undefined}>
                {item.label}
              </a>
            </li>
          {/each}
        </ul>
      </nav>
    {/if}
  </aside>
  <main id="main" class="content" tabindex="-1">
    <div class="inner">{@render children()}</div>
  </main>
</div>

<style>
  .ui-shell {
    display: grid;
    grid-template-columns: 252px minmax(0, 1fr);
    min-height: 100vh;
    background: var(--bg);
  }
  .sidebar {
    background: var(--sidebar);
    border-right: 1px solid var(--edge);
    padding: 1.25rem 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
  }
  .brand {
    padding: 0 0.6rem;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  nav a {
    display: flex;
    align-items: center;
    min-height: var(--touch);
    padding: 0 0.75rem;
    border-radius: var(--radius-sm);
    color: var(--muted);
    text-decoration: none;
    font-size: 0.9375rem;
    font-weight: 500;
  }
  nav a:hover {
    background: var(--raised);
    color: var(--text);
  }
  nav a.current {
    background: var(--raised);
    color: var(--text);
    box-shadow: inset 3px 0 var(--accent);
    font-weight: 600;
  }
  .content {
    min-width: 0;
    outline: none;
  }
  .inner {
    max-width: 1180px;
    padding: 2rem 2.5rem 3rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  @media (max-width: 860px) {
    .ui-shell {
      grid-template-columns: minmax(0, 1fr);
    }
    .sidebar {
      border-right: 0;
      border-bottom: 1px solid var(--edge);
      padding: 0.9rem;
      gap: 0.75rem;
    }
    ul {
      flex-direction: row;
      overflow-x: auto;
      gap: 0.25rem;
      padding-bottom: 0.25rem;
    }
    nav a {
      white-space: nowrap;
    }
    nav a.current {
      box-shadow: inset 0 -3px var(--accent);
    }
    .inner {
      padding: 1.25rem 1rem 2.5rem;
    }
  }
</style>
