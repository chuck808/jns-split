<script lang="ts">
  import Button from '#lib/ui/Button.svelte';
  import Card from '#lib/ui/Card.svelte';
  import EmptyState from '#lib/ui/EmptyState.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import StatusChip from '#lib/ui/StatusChip.svelte';
  import { KIND_LABELS, bandSummary } from '#lib/family';
  let { data, form } = $props();
  const access = $derived(data.access);
  const rider = $derived(access.rider);
  const riders = $derived(`/club/${data.club.id}/riders`);
  // Pre-select when only one kind is allowed; otherwise the admin chooses.
  let kind = $derived(access.allowedKinds.length === 1 ? access.allowedKinds[0] : '');
  const date = (value: string) =>
    new Date(value).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC'
    }) + ' UTC';
  const tone = (s: string) =>
    s === 'pending'
      ? 'info'
      : s === 'accepted'
        ? 'success'
        : s === 'unavailable'
          ? 'warn'
          : 'neutral';
  const statusText = (s: string) =>
    s === 'pending' ? 'Waiting' : s.charAt(0).toUpperCase() + s.slice(1);
  const pending = $derived(
    access.invitations.filter((i) => i.status === 'pending' || i.status === 'expired')
  );
  const past = $derived(
    access.invitations.filter((i) => i.status !== 'pending' && i.status !== 'expired')
  );
</script>

<svelte:head><title>Family access · {rider.display_name} · JNS SPLIT</title></svelte:head>

<PageHeader
  eyebrow="Riders & tags"
  title={rider.display_name}
  description="Who can sign in and see this rider. Riders never need an account to ride."
>
  {#snippet actions()}
    <Button href={riders}>Back to Riders & tags</Button>
  {/snippet}
</PageHeader>

{#if form?.message}<p class="feedback" class:error={!form.ok} role="status">{form.message}</p>{/if}

{#if access.corrections.length}
  <Card title="Correction requests" tone="highlight">
    <p class="note">
      Sent by people linked to {rider.display_name}. Make any change in Riders & tags, then mark the
      request as dealt with.
    </p>
    <ul class="list">
      {#each access.corrections as request (request.id)}
        <li>
          <p class="message">“{request.message}”</p>
          <span class="note">{request.email} · {date(request.created_at)}</span>
          <form method="POST" action="?/resolve">
            <input type="hidden" name="requestId" value={request.id} />
            <Button type="submit">Mark as dealt with</Button>
          </form>
        </li>
      {/each}
    </ul>
  </Card>
{/if}

<div class="two">
  <Card title="Invite someone">
    {#if rider.archived_at}
      <EmptyState title="This rider is archived">
        Archived riders can’t be invited or seen.
      </EmptyState>
    {:else if !access.allowedKinds.length}
      <EmptyState title="Year of birth needed">
        {bandSummary(access)}
        <a href={riders}>Add it in Riders & tags</a>.
      </EmptyState>
    {:else}
      <p class="note">{bandSummary(access)}</p>
      <form method="POST" action="?/invite" class="stack">
        {#if access.allowedKinds.length > 1}
          <fieldset>
            <legend>Who are you inviting?</legend>
            {#each access.allowedKinds as option (option)}
              <label class="checkbox-label">
                <input type="radio" name="kind" value={option} bind:group={kind} required />
                {KIND_LABELS[option]}
              </label>
            {/each}
          </fieldset>
        {:else}
          <input type="hidden" name="kind" value={kind} />
          <p class="who">Inviting: <strong>{KIND_LABELS[access.allowedKinds[0]]}</strong></p>
        {/if}
        <label>
          Their email<input type="email" name="email" required maxlength="254" autocomplete="off" />
        </label>
        <label class="checkbox-label">
          <input type="checkbox" name="checked" value="yes" required />
          {kind === 'rider'
            ? 'I’ve checked this is the rider’s own email, using our club’s usual process.'
            : 'I’ve checked this person is the rider’s parent or guardian, using our club’s usual process.'}
        </label>
        <div><Button type="submit" variant="primary">Create invitation</Button></div>
      </form>
      <ol class="steps">
        <li>The invitation works once, for that email only, and lasts seven days.</li>
        <li>
          {data.emailOn
            ? 'We email them a link. They sign in, or create an account, with that address and open'
            : 'No email is sent from this installation. Ask them to sign in, or create an account at /signup, with that address and open'}
          <strong>Riders and family</strong>.
        </li>
        <li>
          Once they accept, they see {rider.display_name}’s details and choose how their name shows
          on the scoreboard. Results will appear there once timing is recording.
        </li>
      </ol>
    {/if}
  </Card>

  <Card title="Who can see {rider.display_name}">
    {#each access.links as link (link.id)}
      <article class="item">
        <div class="row">
          <strong>{link.email}</strong>
          <StatusChip tone="success">{KIND_LABELS[link.kind]}</StatusChip>
        </div>
        <span class="note">Linked {date(link.created_at)}</span>
        <details>
          <summary>Remove access</summary>
          <form method="POST" action="?/unlink" class="stack">
            <input type="hidden" name="linkId" value={link.id} />
            <label class="checkbox-label">
              <input type="checkbox" name="confirm" value="yes" required />Stop {link.email} seeing
              {rider.display_name}. Any other riders linked to them are unchanged.
            </label>
            <div><Button type="submit" variant="danger">Remove access</Button></div>
          </form>
        </details>
      </article>
    {:else}
      <EmptyState title="Nobody linked yet">
        That’s normal. {rider.display_name} can ride with just their tag.
      </EmptyState>
    {/each}

    {#if pending.length}
      <h3>Invitations</h3>
      {#each pending as invite (invite.id)}
        <article class="item">
          <div class="row">
            <strong>{invite.email}</strong>
            <StatusChip tone={tone(invite.status)}>{statusText(invite.status)}</StatusChip>
          </div>
          <span class="note">
            {KIND_LABELS[invite.kind]} ·
            {invite.status === 'expired' ? 'Expired' : 'Expires'}
            {date(invite.expires_at)}
          </span>
          <div class="actions">
            <form method="POST" action="?/renew">
              <input type="hidden" name="invitationId" value={invite.id} />
              <Button type="submit">
                {data.emailOn ? 'Renew and email again' : 'Renew for 7 days'}
              </Button>
            </form>
            <form method="POST" action="?/revoke">
              <input type="hidden" name="invitationId" value={invite.id} />
              <Button type="submit" variant="quiet">Withdraw</Button>
            </form>
          </div>
        </article>
      {/each}
    {/if}

    {#if past.length}
      <details class="past">
        <summary>Earlier invitations ({past.length})</summary>
        <ul class="list">
          {#each past as invite (invite.id)}
            <li class="row">
              <span>{invite.email} <span class="note">· {KIND_LABELS[invite.kind]}</span></span>
              <StatusChip tone={tone(invite.status)}>{statusText(invite.status)}</StatusChip>
            </li>
          {/each}
        </ul>
      </details>
    {/if}
  </Card>
</div>

<div class="data-card" id="data">
  <Card title="Data and erasure">
    <div class="two">
      <section class="stack">
        <h3>Full record for a data request</h3>
        <p class="note">
          Everything held about {rider.display_name}, including coaches’ notes, correction reasons
          and who has access. Check it before sending it to a family, and remove anything you’re
          entitled to keep back. Each download is recorded in the club history.
        </p>
        <form method="POST" action={`/club/${data.club.id}/riders/${rider.id}/export`}>
          <Button type="submit">Download full record</Button>
        </form>
        <p class="note">Families can download what they see themselves, from Riders and family.</p>
      </section>

      <section class="stack">
        <h3>Erasure</h3>
        {#if data.erasureRequest}
          <p class="notice stacked">
            <strong>{data.erasureRequest.requested_by}</strong> asked for this rider’s data to be
            erased on {date(data.erasureRequest.created_at)}{data.erasureRequest.message
              ? `: “${data.erasureRequest.message}”`
              : '.'}
          </p>
          <details>
            <summary>Decline, with a reason</summary>
            <form method="POST" action="?/declineErasure" class="stack">
              <input type="hidden" name="requestId" value={data.erasureRequest.id} />
              <label>
                Reason the family will see<textarea name="reason" required maxlength="500" rows="2"
                ></textarea>
              </label>
              <div><Button type="submit">Decline request</Button></div>
            </form>
          </details>
        {/if}
        {#if data.mentions === null}
          <p class="note">
            Erasing deletes {rider.display_name}’s details, results, notes and family access for
            good, and leaves “Removed rider” in the club history.
          </p>
          <div>
            <Button href={`?erase=1#data`} variant="danger">Start erasing…</Button>
          </div>
        {:else}
          {#if data.mentions.length}
            <div class="notice stacked">
              <p>
                <strong>Check these first.</strong> They’re about other riders but mention
                {rider.display_name}’s name, so erasure won’t change them. Edit them if they should
                go.
              </p>
              <ul class="list">
                {#each data.mentions as m, i (i)}
                  <li>
                    <span>“{m.text}”</span>
                    <span class="note">
                      {m.kind} · about {m.about}{m.session ? ` · ${m.session}` : ''}
                    </span>
                  </li>
                {/each}
              </ul>
            </div>
          {:else}
            <p class="note">No notes or requests about other riders mention this name.</p>
          {/if}
          <form method="POST" action="?/erase" class="stack">
            <label>
              Type <strong>{rider.display_name}</strong> to confirm<input
                name="confirmName"
                required
                autocomplete="off"
                spellcheck="false"
              />
            </label>
            <label class="checkbox-label">
              <input type="checkbox" name="understand" value="yes" required />I understand this
              permanently deletes this rider’s details, results, notes and family access. It can’t
              be undone.
            </label>
            <div class="actions">
              <Button type="submit" variant="danger">Erase rider data</Button>
              <Button href={`/club/${data.club.id}/riders/${rider.id}#data`} variant="quiet">
                Cancel
              </Button>
            </div>
          </form>
        {/if}
      </section>
    </div>
  </Card>
</div>

<style>
  .notice.stacked {
    display: block;
  }
  .notice.stacked p {
    margin: 0 0 0.5rem;
  }
  .data-card {
    margin-top: 1rem;
    scroll-margin-top: 1rem;
  }
  .two {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
    align-items: start;
    margin-top: 1rem;
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin: 0;
  }
  fieldset {
    border: 0;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  legend {
    font-weight: 600;
    margin-bottom: 0.4rem;
  }
  .who {
    margin: 0;
  }
  .note {
    font-size: 0.875rem;
    color: var(--muted);
    margin: 0;
  }
  .steps {
    margin: 1rem 0 0;
    padding-left: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    font-size: 0.875rem;
    color: var(--muted);
  }
  .item {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.9rem;
    border-radius: var(--radius);
    background: var(--raised);
    margin-bottom: 0.6rem;
  }
  .item details {
    margin: 0.25rem 0 0;
    padding: 0.4rem 0 0;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    overflow-wrap: anywhere;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .actions form {
    margin: 0;
  }
  h3 {
    margin: 1.25rem 0 0.6rem;
    font-size: 1rem;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .list li {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .list li.row {
    flex-direction: row;
  }
  .message {
    margin: 0;
    color: var(--text);
  }
  .past {
    margin-top: 1rem;
  }
  @media (max-width: 900px) {
    .two {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
