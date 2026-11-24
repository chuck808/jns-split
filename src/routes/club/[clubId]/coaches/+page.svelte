<script lang="ts">
  import Button from '#lib/ui/Button.svelte';
  import Card from '#lib/ui/Card.svelte';
  import EmptyState from '#lib/ui/EmptyState.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import StatusChip from '#lib/ui/StatusChip.svelte';
  let { data, form } = $props();
  const date = (value: string) =>
    new Date(value).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const link = (page: number, invites: number) =>
    '?' + new URLSearchParams({ page: String(page), invites: String(invites) });
  const inviteTone = (s: string) =>
    s === 'pending'
      ? 'info'
      : s === 'accepted'
        ? 'success'
        : s === 'unavailable'
          ? 'warn'
          : 'neutral';
  const inviteText = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
</script>

<svelte:head><title>Coaches & access · {data.club.name} · JNS SPLIT</title></svelte:head>

<PageHeader
  eyebrow={data.club.name}
  title="Coaches & access"
  description="Invite a coach, wait for them to accept, then give them the sessions they need. Linking a coach to the club doesn’t show them riders or history."
/>

{#if form?.message}<p class="feedback" class:error={!form.ok} role="status">{form.message}</p>{/if}

<div class="two">
  <Card title="Invite a coach">
    <form method="POST" action="?/invite" class="stack">
      <label>
        Coach’s email<input type="email" name="email" required maxlength="254" autocomplete="off" />
      </label>
      <div><Button type="submit" variant="primary">Create invitation</Button></div>
    </form>
    <ol class="steps">
      <li>The invitation lasts seven days and only works for that email address.</li>
      <li>
        {data.emailOn
          ? 'We email the coach a link. They sign in, or create an account, with that address and open'
          : 'No email is sent from this installation. Tell the coach to sign in, or create an account at /signup, with that address and open'}
        <strong>Coach</strong> from the account menu, where the invitation is waiting.
      </li>
      <li>Once they accept, add them to sessions from each session’s page.</li>
    </ol>
    <p class="note">
      You can accept a coach invitation for your own club too. You keep your admin role.
    </p>
  </Card>

  <Card title={`Coaches (${data.directory.total})`}>
    {#each data.directory.coaches as coach (coach.user_id)}
      <article class="coach">
        <div class="coach-head">
          <strong>{coach.email}</strong>
          <StatusChip tone="success">Linked</StatusChip>
        </div>
        <span class="note">Since {date(coach.created_at)}</span>
        <details>
          <summary>Remove coach</summary>
          <form method="POST" action="?/remove" class="stack">
            <input type="hidden" name="userId" value={coach.user_id} />
            <label class="checkbox-label">
              <input type="checkbox" name="confirm" value="yes" required />Remove {coach.email} as a coach
              and from all of their sessions at {data.club.name}
            </label>
            <div><Button type="submit" variant="danger">Remove coach</Button></div>
          </form>
        </details>
      </article>
    {:else}
      <EmptyState title="No coaches yet">Invite one to get started.</EmptyState>
    {/each}
    {#if data.directory.pages > 1}
      <nav class="pagination" aria-label="Coach pages">
        {#if data.directory.page > 1}<Button
            href={link(data.directory.page - 1, data.directory.invitePage)}
          >
            Previous
          </Button>{/if}
        <span>Page {data.directory.page} of {data.directory.pages}</span>
        {#if data.directory.page < data.directory.pages}<Button
            href={link(data.directory.page + 1, data.directory.invitePage)}
          >
            Next
          </Button>{/if}
      </nav>
    {/if}
  </Card>
</div>

<Card title={`Invitations (${data.directory.inviteTotal})`}>
  {#if data.directory.invitations.length}
    <ul class="invites">
      {#each data.directory.invitations as invite (invite.id)}
        <li>
          <span class="who">
            <strong>{invite.email}</strong>
            <span class="note">Expires {date(invite.expires_at)}</span>
          </span>
          <StatusChip tone={inviteTone(invite.status)}>{inviteText(invite.status)}</StatusChip>
          {#if ['pending', 'unavailable'].includes(invite.status)}
            <form method="POST" action="?/revoke">
              <input type="hidden" name="invitationId" value={invite.id} />
              <Button
                type="submit"
                variant="quiet"
                aria-label={`Revoke invitation for ${invite.email}`}
              >
                Revoke
              </Button>
            </form>
          {/if}
        </li>
      {/each}
    </ul>
  {:else}
    <EmptyState title="No invitations yet" />
  {/if}
  {#if data.directory.invitePages > 1}
    <nav class="pagination" aria-label="Invitation pages">
      {#if data.directory.invitePage > 1}<Button
          href={link(data.directory.page, data.directory.invitePage - 1)}
        >
          Previous
        </Button>{/if}
      <span>Page {data.directory.invitePage} of {data.directory.invitePages}</span>
      {#if data.directory.invitePage < data.directory.invitePages}<Button
          href={link(data.directory.page, data.directory.invitePage + 1)}
        >
          Next
        </Button>{/if}
    </nav>
  {/if}
  <p class="note">
    “Unavailable” means the admin who sent it no longer has admin access. Revoke it and send a new
    one if it’s still needed.
  </p>
</Card>

<style>
  .two {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
    align-items: start;
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin: 0;
  }
  .stack label {
    margin: 0;
    font-size: 0.875rem;
    color: var(--muted);
  }
  .steps {
    margin: 0;
    padding-left: 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    font-size: 0.875rem;
    color: var(--muted);
  }
  .note {
    font-size: 0.8125rem;
    color: var(--muted);
  }
  .coach {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.8rem 0.9rem;
    border-radius: var(--radius);
    background: var(--raised);
  }
  .coach-head {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .coach details {
    margin: 0.3rem 0 0;
  }
  .invites {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .invites li {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.9rem;
    border-radius: var(--radius);
    background: var(--raised);
    flex-wrap: wrap;
  }
  .invites form {
    margin: 0;
  }
  .who {
    flex: 1 1 220px;
    display: flex;
    flex-direction: column;
  }
  .pagination {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }
  @media (max-width: 960px) {
    .two {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
