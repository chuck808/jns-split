<script lang="ts">
  import { page } from '$app/state';
  let { data, children } = $props();
  const sections = [
    ['', 'Overview'],
    ['riders', 'Riders & tags'],
    ['coaches', 'Coaches'],
    ['sessions', 'Sessions'],
    ['equipment', 'Test equipment'],
    ['settings', 'Settings']
  ];
</script>

<div class="app-shell">
  <aside>
    <a class="brand" href="/club">
      <img src="/favicon.svg" alt="" /><span><small>JNS</small><strong>SPLIT</strong></span>
    </a>
    <p class="workspace-label">CLUB ADMINISTRATION</p>
    <div class="club">
      <span class="avatar">CL</span>
      <div>{data.club.name}<small>Administrator</small></div>
    </div>
    <nav aria-label="Club navigation">
      {#each sections as [path, label]}{@const href = `/club/${data.club.id}${path ? '/' + path : ''}`}<a
          class="nav-link"
          class:active={page.url.pathname === href}
          aria-current={page.url.pathname === href ? 'page' : undefined}
          {href}
        >
          {label}
        </a>{/each}
    </nav>
    <div class="side-bottom"><a class="text-link" href="/bench">Bench simulator</a></div>
  </aside>
  <main>
    <header>
      <div>
        <span class="eyebrow">CLUB WORKSPACE</span>
        <h2>{data.club.name}</h2>
      </div>
      <div class="form-row">
        <a class="text-link" href="/club">Your clubs</a>
        <form method="POST" action="/logout"><button>Sign out</button></form>
      </div>
    </header>
    {@render children()}
    <footer>JNS SPLIT <span>Every effort counts.</span></footer>
  </main>
</div>
