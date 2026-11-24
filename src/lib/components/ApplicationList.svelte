<script lang="ts">
  import type { ApplicationList } from '#lib/club-admission';
  import { sessionDate } from '#lib/training-sessions';
  import Button from '#lib/ui/Button.svelte';
  import EmptyState from '#lib/ui/EmptyState.svelte';
  import ApplicationStatus from './ApplicationStatus.svelte';
  let {
    list,
    status,
    platform = false
  }: { list: ApplicationList; status: string; platform?: boolean } = $props();
  const link = (page: number) => '?' + new URLSearchParams({ status, page: String(page) });
</script>

<form method="GET" class="filters">
  <label>
    Show<select name="status" value={status}>
      <option value="all">All</option>
      <option value="submitted">Waiting for review</option>
      <option value="approved">Approved</option>
      <option value="declined">Declined</option>
      <option value="withdrawn">Withdrawn</option>
    </select>
  </label>
  <Button type="submit">Filter</Button>
  <span class="count">{list.total} {list.total === 1 ? 'application' : 'applications'}</span>
</form>

{#if list.items.length}
  <ul class="apps">
    {#each list.items as app (app.id)}
      <li>
        <a class="app" href={`${platform ? '/admin' : '/clubs'}/applications/${app.id}`}>
          <span class="name">{app.club_name}</span>
          <span class="meta">{app.town} · submitted {sessionDate(app.created_at)}</span>
          <span class="status"><ApplicationStatus status={app.status} /></span>
        </a>
      </li>
    {/each}
  </ul>
{:else}
  <EmptyState title="No applications match this filter" />
{/if}

{#if list.pages > 1}
  <nav class="pagination" aria-label="Application pages">
    {#if list.page > 1}<Button href={link(list.page - 1)}>Previous</Button>{/if}
    <span>Page {list.page} of {list.pages}</span>
    {#if list.page < list.pages}<Button href={link(list.page + 1)}>Next</Button>{/if}
  </nav>
{/if}

<style>
  .filters {
    display: flex;
    gap: 0.75rem;
    align-items: flex-end;
    flex-wrap: wrap;
    margin: 0;
  }
  .filters label {
    flex: 0 1 200px;
    margin: 0;
    font-size: 0.875rem;
    color: var(--muted);
  }
  .count {
    margin-left: auto;
    align-self: center;
    font-size: 0.875rem;
    color: var(--muted);
  }
  .apps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .app {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.15rem 1rem;
    padding: 0.85rem 1rem;
    border-radius: var(--radius);
    background: var(--raised);
    border: 1px solid transparent;
    color: var(--text);
    text-decoration: none;
  }
  .app:hover {
    border-color: var(--accent-edge);
    color: var(--text);
  }
  .name {
    font-weight: 600;
  }
  .meta {
    font-size: 0.875rem;
    color: var(--muted);
  }
  .status {
    grid-column: 2;
    grid-row: 1 / span 2;
    align-self: center;
  }
  .pagination {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }
</style>
