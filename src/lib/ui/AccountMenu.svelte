<script lang="ts">
  import { page } from '$app/state';
  import type { ShellData } from '#lib/workspaces';
  import { initials } from './format';

  let { shell, theme = 'system' }: { shell: ShellData; theme?: string } = $props();

  const current = $derived(shell.workspaces.find((w) => w.key === shell.currentKey));
  const others = $derived(shell.workspaces.filter((w) => w.key !== shell.currentKey));
  const returnTo = $derived(page.url.pathname + page.url.search);
</script>

<!-- A native disclosure: works without JavaScript and with the keyboard. -->
<details class="account-menu">
  <summary>
    <span class="avatar" aria-hidden="true">{initials(shell.email.split('@')[0])}</span>
    <span class="who">
      <span class="role">{current?.label ?? 'Your account'}</span>
      <span class="email">{shell.email}</span>
    </span>
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        stroke-width="1.6"
        fill="none"
        stroke-linecap="round"
      />
    </svg>
  </summary>
  <div class="panel-menu">
    {#if others.length}
      <p class="heading">Switch to</p>
      <ul>
        {#each others as workspace (workspace.key)}
          <li>
            <!-- Posting to /app remembers the choice; /app re-checks access. -->
            <form method="POST" action="/app">
              <input type="hidden" name="workspace" value={workspace.key} />
              <button type="submit" class="item">
                <span class="label">{workspace.label}</span>
                <span class="description">{workspace.description}</span>
              </button>
            </form>
          </li>
        {/each}
      </ul>
    {/if}
    <form method="POST" action="/preferences" class="theme">
      <input type="hidden" name="returnTo" value={returnTo} />
      <label for="account-theme">Appearance</label>
      <div class="theme-row">
        <select id="account-theme" name="theme" value={theme}>
          <option value="system">Match device</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
        <button type="submit">Apply</button>
      </div>
    </form>
    <nav class="links" aria-label="Account">
      <a href="/account">Account settings</a>
      <a href="/help">Help</a>
    </nav>
    <form method="POST" action="/logout">
      <button type="submit" class="signout">Sign out</button>
    </form>
  </div>
</details>

<style>
  .account-menu {
    position: relative;
  }
  summary {
    list-style: none;
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.55rem 0.6rem;
    border: 1px solid var(--edge);
    border-radius: var(--radius);
    cursor: pointer;
    min-height: var(--touch);
    color: var(--text);
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }
  .avatar {
    width: 34px;
    height: 34px;
    border-radius: 999px;
    flex: none;
    display: grid;
    place-items: center;
    background: var(--accent-soft);
    color: var(--accent-text);
    font: 600 0.8125rem var(--font-body);
  }
  .who {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }
  .role {
    font-weight: 600;
    font-size: 0.875rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .email {
    font-size: 0.75rem;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .panel-menu {
    position: absolute;
    z-index: 20;
    left: 0;
    right: 0;
    min-width: 260px;
    margin-top: 0.4rem;
    background: var(--surface);
    border: 1px solid var(--edge-strong);
    border-radius: var(--radius);
    padding: 0.5rem;
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.25);
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .heading {
    margin: 0.25rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--muted);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .item {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.1rem;
    text-align: left;
    border: 0;
    background: transparent;
    padding: 0.6rem 0.5rem;
    border-radius: var(--radius-sm);
    min-height: var(--touch);
  }
  .item:hover {
    background: var(--raised);
  }
  .item .label {
    font-weight: 600;
    font-size: 0.9375rem;
  }
  .item .description {
    font-size: 0.8125rem;
    color: var(--muted);
  }
  .theme {
    border-top: 1px solid var(--edge);
    padding: 0.6rem 0.5rem 0.2rem;
  }
  .theme label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--muted);
  }
  .theme-row {
    display: flex;
    gap: 0.4rem;
    margin-top: 0.35rem;
  }
  .theme-row select {
    margin: 0;
    padding: 0.45rem;
  }
  .theme-row button {
    padding: 0.45rem 0.8rem;
  }
  .links {
    display: flex;
    flex-direction: column;
    border-top: 1px solid var(--edge);
    padding-top: 0.35rem;
  }
  .links a {
    display: flex;
    align-items: center;
    min-height: var(--touch);
    padding: 0 0.5rem;
    border-radius: var(--radius-sm);
    color: var(--text);
    text-decoration: none;
    font-size: 0.9375rem;
  }
  .links a:hover {
    background: var(--raised);
  }
  .signout {
    width: 100%;
    background: transparent;
    border: 1px solid var(--edge);
    min-height: var(--touch);
  }
</style>
