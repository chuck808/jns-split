<script lang="ts">
  import type { ApplicationList } from '#lib/club-admission';
  import { sessionDate } from '#lib/training-sessions';
  let {
    list,
    status,
    platform = false
  }: { list: ApplicationList; status: string; platform?: boolean } = $props();
  const link = (page: number) => '?' + new URLSearchParams({ status, page: String(page) });
</script>

<form method="GET" class="form-row">
  <label>
    Status<select name="status" value={status}>
      <option value="all">All</option><option value="submitted">Awaiting review</option><option
        value="approved"
      >
        Approved
      </option><option value="declined">Declined</option><option value="withdrawn">
        Withdrawn
      </option>
    </select>
  </label><button>Filter applications</button>
</form>
<p>{list.total} matching applications</p>
<div class="table-wrap">
  <table>
    <thead>
      <tr><th>Club</th><th>Town / region</th><th>Status</th><th>Submitted</th></tr>
    </thead><tbody>
      {#each list.items as app}<tr>
          <td>
            <a href={`${platform ? '/admin' : '/clubs'}/applications/${app.id}`}>{app.club_name}</a>
          </td><td>{app.town}</td><td>
            {app.status === 'submitted' ? 'Awaiting review' : app.status}
          </td><td>{sessionDate(app.created_at)}</td>
        </tr>{/each}
    </tbody>
  </table>
</div>
{#if !list.items.length}<p>No applications match this filter.</p>{/if}
<nav class="pagination" aria-label="Application pages">
  {#if list.page > 1}<a href={link(list.page - 1)}>Previous</a>{/if}<span>
    Page {list.page} of {list.pages}
  </span>{#if list.page < list.pages}<a href={link(list.page + 1)}>Next</a>{/if}
</nav>
