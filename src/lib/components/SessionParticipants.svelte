<script lang="ts">
  import type { TrainingSession } from '#lib/training-sessions';
  import type { ParticipantPage, CandidatePage } from '#lib/session-participants';
  import Button from '#lib/ui/Button.svelte';
  import Card from '#lib/ui/Card.svelte';
  import EmptyState from '#lib/ui/EmptyState.svelte';
  import StatusChip from '#lib/ui/StatusChip.svelte';
  let {
    session,
    isAdmin,
    participants,
    candidates,
    query
  }: {
    session: TrainingSession;
    isAdmin: boolean;
    participants: ParticipantPage;
    candidates: CandidatePage | null;
    query: string;
  } = $props();
  const params = (changes: Record<string, string> = {}) =>
    new URLSearchParams({
      riderQuery: query,
      participantsPage: String(participants.page),
      candidatesPage: String(candidates?.page ?? 1),
      ...changes
    }).toString();
</script>

<Card title={`Riders on the list (${participants.total})`}>
  <p class="note">
    Being on the list doesn’t mark attendance or assign a lane. Riders still scan at their lane for
    every effort.
  </p>
  {#if !isAdmin}<p class="note">
      You can see this list but not change it. Tags and wider rider history aren’t shared with
      coaches.
    </p>{/if}
  {#if participants.items.length}
    <ul class="riders">
      {#each participants.items as rider (rider.id)}
        <li>
          <span class="name">{rider.display_name}</span>
          {#if rider.archived}<StatusChip>Archived · kept in this session</StatusChip>{/if}
          {#if isAdmin && session.status === 'planned'}
            <form method="POST" action={`?/removeParticipant&${params()}`}>
              <input type="hidden" name="version" value={session.version} />
              <input type="hidden" name="riderId" value={rider.id} />
              <Button
                type="submit"
                variant="quiet"
                aria-label={`Remove ${rider.display_name} from this session`}
              >
                Remove
              </Button>
            </form>
          {/if}
        </li>
      {/each}
    </ul>
  {:else}
    <EmptyState title="No riders on the list yet" />
  {/if}
  {#if participants.pages > 1}
    <nav class="pagination" aria-label="Participant pages">
      {#if participants.page > 1}<Button
          href={`?${params({ participantsPage: String(participants.page - 1) })}`}
        >
          Previous
        </Button>{/if}
      <span>Page {participants.page} of {participants.pages}</span>
      {#if participants.page < participants.pages}<Button
          href={`?${params({ participantsPage: String(participants.page + 1) })}`}
        >
          Next
        </Button>{/if}
    </nav>
  {/if}
  {#if session.status !== 'planned'}<p class="note">
      This session is {session.status}, so the list is read-only.
    </p>{/if}

  {#if isAdmin && session.status === 'planned' && candidates}
    <h3>Add riders</h3>
    <p class="note">Active club riders not already on the list. A tag isn’t needed to plan.</p>
    <form method="GET" class="search">
      <input type="hidden" name="participantsPage" value={participants.page} />
      <label>Search by name<input name="riderQuery" maxlength="60" value={query} /></label>
      <Button type="submit">Search</Button>
      <a href={`?${params({ riderQuery: '', candidatesPage: '1' })}`}>Clear</a>
    </form>
    {#if candidates.items.length}
      <ul class="riders">
        {#each candidates.items as rider (rider.id)}
          <li>
            <span class="name">{rider.display_name}</span>
            <form method="POST" action={`?/addParticipant&${params()}`}>
              <input type="hidden" name="version" value={session.version} />
              <input type="hidden" name="riderId" value={rider.id} />
              <Button type="submit" aria-label={`Add ${rider.display_name} to this session`}>
                Add
              </Button>
            </form>
          </li>
        {/each}
      </ul>
    {:else}
      <EmptyState title="No riders match">
        Clear the search, or register the rider in Riders & tags first.
      </EmptyState>
    {/if}
    {#if candidates.pages > 1}
      <nav class="pagination" aria-label="Eligible rider pages">
        {#if candidates.page > 1}<Button
            href={`?${params({ candidatesPage: String(candidates.page - 1) })}`}
          >
            Previous
          </Button>{/if}
        <span>Page {candidates.page} of {candidates.pages}</span>
        {#if candidates.page < candidates.pages}<Button
            href={`?${params({ candidatesPage: String(candidates.page + 1) })}`}
          >
            Next
          </Button>{/if}
      </nav>
    {/if}
  {/if}
</Card>

<style>
  .note {
    font-size: 0.875rem;
    color: var(--muted);
  }
  .riders {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 0.5rem;
  }
  .riders li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    padding: 0.3rem 0.4rem 0.3rem 0.9rem;
    min-height: 52px;
    border-radius: var(--radius);
    background: var(--raised);
  }
  .riders form {
    margin: 0 0 0 auto;
  }
  .name {
    font-weight: 600;
  }
  h3 {
    margin: 0.75rem 0 0;
    font-size: 1rem;
  }
  .search {
    display: flex;
    gap: 0.75rem;
    align-items: flex-end;
    flex-wrap: wrap;
    margin: 0;
  }
  .search label {
    flex: 1 1 240px;
    margin: 0;
    font-size: 0.875rem;
    color: var(--muted);
  }
  .search a {
    align-self: center;
  }
  .pagination {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }
</style>
