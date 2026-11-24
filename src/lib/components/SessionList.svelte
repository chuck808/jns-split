<script lang="ts">
  import { activityLabel, sessionDate, type SessionList } from '#lib/training-sessions';
  import Button from '#lib/ui/Button.svelte';
  import EmptyState from '#lib/ui/EmptyState.svelte';
  import StatusChip from '#lib/ui/StatusChip.svelte';
  let {
    list,
    status,
    showClub = false
  }: { list: SessionList; status: string; showClub?: boolean } = $props();
  const link = (n: number) => '?' + new URLSearchParams({ status, page: String(n) });
  const statusTone = (s: string) =>
    s === 'planned' ? 'info' : s === 'closed' ? 'success' : 'neutral';
  const statusText = (s: string) =>
    s === 'planned' ? 'Planned' : s === 'closed' ? 'Closed' : 'Cancelled';
</script>

<form method="GET" class="filters">
  <label>
    Show<select name="status" value={status}>
      <option value="planned">Planned</option>
      <option value="closed">Closed</option>
      <option value="cancelled">Cancelled</option>
      <option value="all">All sessions</option>
    </select>
  </label>
  <Button type="submit">Filter</Button>
  <span class="count">{list.total} {list.total === 1 ? 'session' : 'sessions'}</span>
</form>

{#if list.items.length}
  <ul class="sessions">
    {#each list.items as session (session.id)}
      <li>
        <a class="session" href={`/sessions/${session.id}`}>
          <span class="when">{sessionDate(session.scheduled_at)}</span>
          <span class="name">{session.name}</span>
          <span class="meta">
            {#if showClub && session.club_name}{session.club_name} ·
            {/if}{activityLabel(session.activity)} · {session.start_mode === 'flying'
              ? 'Flying'
              : 'Standing'}
            {session.distance_metres} m · {session.lane_count}
            {session.lane_count === 1 ? 'lane' : 'lanes'}
          </span>
          <span class="status">
            <StatusChip tone={statusTone(session.status)}>{statusText(session.status)}</StatusChip>
          </span>
        </a>
      </li>
    {/each}
  </ul>
{:else}
  <EmptyState title="No sessions match this filter" />
{/if}

{#if list.pages > 1}
  <nav class="pagination" aria-label="Session pages">
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
    font-weight: 500;
    color: var(--muted);
  }
  .count {
    margin-left: auto;
    font-size: 0.875rem;
    color: var(--muted);
    align-self: center;
  }
  .sessions {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .session {
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
  .session:hover {
    border-color: var(--accent-edge);
    color: var(--text);
  }
  .when {
    grid-column: 1;
    font-size: 0.8125rem;
    color: var(--muted);
  }
  .name {
    grid-column: 1;
    font-weight: 600;
    font-size: 1rem;
  }
  .meta {
    grid-column: 1;
    font-size: 0.875rem;
    color: var(--muted);
  }
  .status {
    grid-column: 2;
    grid-row: 1 / span 3;
    align-self: center;
  }
  .pagination {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }
</style>
