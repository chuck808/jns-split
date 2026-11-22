<script lang="ts">
  let { data, form } = $props();
  const date = (value: string) =>
    new Date(value).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const link = (page: number, invites: number) =>
    '?' + new URLSearchParams({ page: String(page), invites: String(invites) });
</script>

<svelte:head><title>Coaches · {data.club.name} · JNS SPLIT</title></svelte:head>
<h1>Coaches</h1>
<p>
  Invite coaches to establish an approved club link, then assign their session permissions.
  Rider-history access remains separate. Club administrators can also accept a coach invitation for
  this club without losing their administrator role.
</p>
{#if form?.message}<p class="feedback" class:error={!form.ok} role="status">{form.message}</p>{/if}
<section class="panel">
  <h2>Invite a coach</h2>
  <form method="POST" action="?/invite">
    <label>
      Coach account email<input
        type="email"
        name="email"
        required
        maxlength="254"
        autocomplete="off"
      />
    </label>
    <p>
      Invitations expire after seven days and must be accepted by a confirmed account with this
      email address. No email is sent in this pilot. A new coach account must first be provisioned
      by the project owner.
    </p>
    <button class="solid">Create invitation</button>
  </form>
  <p>
    After creating the invitation, ask the coach to sign in to this installation and choose <strong>
      Coach workspace
    </strong> in the top navigation. They will see their invitation there.
  </p>
</section>
<section class="panel">
  <h2>Approved coaches ({data.directory.total})</h2>
  {#each data.directory.coaches as coach}<article class="panel">
      <h3>{coach.email}</h3>
      <p>Linked {date(coach.created_at)}</p>
      <details>
        <summary>Remove coach</summary>
        <form method="POST" action="?/remove">
          <input type="hidden" name="userId" value={coach.user_id} /><label class="checkbox-label">
            <input type="checkbox" name="confirm" value="yes" required />Remove the coach role and
            its session assignments from {data.club.name}
          </label><button>Remove coach role</button>
        </form>
      </details>
    </article>{:else}<p>No approved coaches yet.</p>{/each}
  <nav class="pagination" aria-label="Coach pages">
    {#if data.directory.page > 1}<a href={link(data.directory.page - 1, data.directory.invitePage)}>
        Previous
      </a>{/if}<span>
      Page {data.directory.page} of {data.directory.pages}
    </span>{#if data.directory.page < data.directory.pages}<a
        href={link(data.directory.page + 1, data.directory.invitePage)}
      >
        Next
      </a>{/if}
  </nav>
</section>
<section class="panel">
  <h2>Invitations ({data.directory.inviteTotal})</h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Email</th><th>Status</th><th>Expires</th><th>Action</th></tr></thead><tbody>
        {#each data.directory.invitations as invite}<tr>
            <td>{invite.email}</td><td>{invite.status}</td><td>{date(invite.expires_at)}</td><td>
              {#if ['pending', 'unavailable'].includes(invite.status)}<form
                  method="POST"
                  action="?/revoke"
                >
                  <input type="hidden" name="invitationId" value={invite.id} /><button>
                    Revoke
                  </button>
                </form>{:else}—{/if}
            </td>
          </tr>{/each}
      </tbody>
    </table>
  </div>
  {#if !data.directory.inviteTotal}<p>No invitations created.</p>{/if}
  <nav class="pagination" aria-label="Invitation pages">
    {#if data.directory.invitePage > 1}<a
        href={link(data.directory.page, data.directory.invitePage - 1)}
      >
        Previous
      </a>{/if}<span>
      Page {data.directory.invitePage} of {data.directory.invitePages}
    </span>{#if data.directory.invitePage < data.directory.invitePages}<a
        href={link(data.directory.page, data.directory.invitePage + 1)}
      >
        Next
      </a>{/if}
  </nav>
  <p class="caption">
    Unavailable means the issuing administrator no longer has admin access. Revoke and create a new
    invitation if appropriate.
  </p>
</section>
