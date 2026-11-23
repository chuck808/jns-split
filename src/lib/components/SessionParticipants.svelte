<script lang="ts">
  import type { TrainingSession } from '#lib/training-sessions';
  import type { ParticipantPage, CandidatePage } from '#lib/session-participants';
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

<section class="panel">
  <h2>Session participants ({participants.total})</h2>
  <p>
    These riders are included in this session plan. Inclusion does not mark attendance, assign a
    lane or record an attempt. Each run will still require a lane scan when the controller
    integration is available.
  </p>
  {#if !isAdmin}<p class="caption">
      Your assignment allows you to view these participants only. Club administrators manage this
      list; rider tags and wider history are not shared.
    </p>{/if}
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Rider</th><th>
            Registration status
          </th>{#if isAdmin && session.status === 'planned'}<th>Action</th>{/if}
        </tr>
      </thead><tbody>
        {#each participants.items as rider}<tr>
            <td>{rider.display_name}</td><td>
              {rider.archived ? 'Archived — retained in session history' : 'Active'}
            </td>{#if isAdmin && session.status === 'planned'}<td>
                <form method="POST" action={`?/removeParticipant&${params()}`}>
                  <input type="hidden" name="version" value={session.version} /><input
                    type="hidden"
                    name="riderId"
                    value={rider.id}
                  /><button aria-label={`Remove ${rider.display_name} from this session`}>
                    Remove
                  </button>
                </form>
              </td>{/if}
          </tr>{/each}
      </tbody>
    </table>
  </div>
  {#if !participants.total}<p>No participants have been added yet.</p>{/if}
  <nav class="pagination" aria-label="Participant pages">
    {#if participants.page > 1}<a
        href={`?${params({ participantsPage: String(participants.page - 1) })}`}
      >
        Previous participants
      </a>{/if}<span>
      Page {participants.page} of {participants.pages}
    </span>{#if participants.page < participants.pages}<a
        href={`?${params({ participantsPage: String(participants.page + 1) })}`}
      >
        Next participants
      </a>{/if}
  </nav>
  {#if session.status !== 'planned'}<p>
      This session is {session.status}; its participant list is read-only. Registration status
      reflects the rider’s current club record.
    </p>{/if}
  {#if isAdmin && session.status === 'planned' && candidates}<h3>Add riders from this club</h3>
    <p>
      Only active club riders who are not already in this session are listed. A tag is not required
      for planning.
    </p>
    <form method="GET" class="form-row">
      <input type="hidden" name="participantsPage" value={participants.page} /><label>
        Search rider name<input name="riderQuery" maxlength="60" value={query} />
      </label><button>Search riders</button><a
        class="text-link"
        href={`?${params({ riderQuery: '', candidatesPage: '1' })}`}
      >
        Clear search
      </a>
    </form>
    <p>{candidates.total} eligible riders match this search.</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Rider</th><th>Add to session</th></tr></thead><tbody>
          {#each candidates.items as rider}<tr>
              <td>{rider.display_name}</td><td>
                <form method="POST" action={`?/addParticipant&${params()}`}>
                  <input type="hidden" name="version" value={session.version} /><input
                    type="hidden"
                    name="riderId"
                    value={rider.id}
                  /><button aria-label={`Add ${rider.display_name} to this session`}>
                    Add rider
                  </button>
                </form>
              </td>
            </tr>{/each}
        </tbody>
      </table>
    </div>
    {#if !candidates.total}<p>
        No eligible riders match. Clear the search, or register a rider in the club register.
      </p>{/if}
    <nav class="pagination" aria-label="Eligible rider pages">
      {#if candidates.page > 1}<a
          href={`?${params({ candidatesPage: String(candidates.page - 1) })}`}
        >
          Previous riders
        </a>{/if}<span>
        Page {candidates.page} of {candidates.pages}
      </span>{#if candidates.page < candidates.pages}<a
          href={`?${params({ candidatesPage: String(candidates.page + 1) })}`}
        >
          Next riders
        </a>{/if}
    </nav>
    <a class="text-link" href={`/club/${session.club_id}/riders`}>Open club register</a>{/if}
</section>
