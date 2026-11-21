<script lang="ts">
  import { sessionDate, type SessionList } from '#lib/training-sessions';
  let { list, status }: { list: SessionList; status: string } = $props();
  const link = (n: number) => '?' + new URLSearchParams({ status, page: String(n) });
</script>

<form method="GET" class="form-row">
  <label>
    Status<select name="status" value={status}>
      <option value="planned">Planned</option><option value="closed">Closed</option><option
        value="cancelled"
      >
        Cancelled
      </option><option value="all">All sessions</option>
    </select>
  </label><button>Filter sessions</button>
</form>
<p>{list.total} matching sessions</p>
<div class="table-wrap">
  <table>
    <thead>
      <tr><th>Session</th><th>Club</th><th>Scheduled (UTC)</th><th>Setup</th><th>Status</th></tr>
    </thead><tbody>
      {#each list.items as session}<tr>
          <td><a class="text-link" href={`/sessions/${session.id}`}>{session.name}</a></td><td>
            {session.club_name}
          </td><td>{sessionDate(session.scheduled_at)}</td><td>
            {session.distance_metres} m · {session.start_mode} · {session.lane_count} lanes
          </td><td>{session.status}</td>
        </tr>{/each}
    </tbody>
  </table>
</div>
{#if !list.items.length}<p>No sessions match this filter.</p>{/if}
<nav class="pagination" aria-label="Session pages">
  {#if list.page > 1}<a href={link(list.page - 1)}>Previous</a>{/if}<span>
    Page {list.page} of {list.pages}
  </span>{#if list.page < list.pages}<a href={link(list.page + 1)}>Next</a>{/if}
</nav>
