<script lang="ts">
  import SessionFields from '#lib/components/SessionFields.svelte';
  import SessionParticipants from '#lib/components/SessionParticipants.svelte';
  import SessionResults from '#lib/components/SessionResults.svelte';
  import { sessionDate, activityLabel } from '#lib/training-sessions';
  import Button from '#lib/ui/Button.svelte';
  import Card from '#lib/ui/Card.svelte';
  import ChoiceGroup from '#lib/ui/ChoiceGroup.svelte';
  import EmptyState from '#lib/ui/EmptyState.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import StatusChip from '#lib/ui/StatusChip.svelte';
  let { data, form } = $props();
  let session = $derived(data.detail.session);
  let activity = $derived(data.detail.session.activity as string);
  const statusText = (s: string) =>
    s === 'planned' ? 'Planned' : s === 'closed' ? 'Closed' : 'Cancelled';
  const access = $derived(
    data.detail.isAdmin
      ? 'Club administrator'
      : data.detail.canManage
        ? 'Coach · can edit and close'
        : 'Coach · view only'
  );
</script>

<svelte:head><title>{session.name} · JNS SPLIT</title></svelte:head>

<PageHeader eyebrow={data.detail.clubName} title={session.name}>
  {#snippet actions()}
    <Button href={`/sessions/${session.id}/trackside`} variant="primary">Trackside view</Button>
    <Button href={data.detail.isAdmin ? `/club/${session.club_id}/sessions` : '/coach/sessions'}>
      Back to sessions
    </Button>
  {/snippet}
</PageHeader>

{#if form?.message}<p class="feedback" class:error={!form.ok} role="status">{form.message}</p>{/if}

<Card>
  <div class="chips">
    <StatusChip tone={session.status === 'planned' ? 'info' : 'neutral'}>
      {statusText(session.status)}
    </StatusChip>
    <StatusChip>{activityLabel(session.activity)}</StatusChip>
  </div>
  <dl class="facts">
    <div>
      <dt>Start</dt>
      <dd>{session.start_mode === 'flying' ? 'Flying' : 'Standing'}</dd>
    </div>
    <div>
      <dt>Distance</dt>
      <dd>{session.distance_metres} m</dd>
    </div>
    <div>
      <dt>Lanes</dt>
      <dd>{session.lane_count}</dd>
    </div>
    <div>
      <dt>When</dt>
      <dd class="when">{sessionDate(session.scheduled_at)}</dd>
    </div>
  </dl>
  <p class="note">
    Your access: <strong>{access}</strong>. Results appear below as timing equipment saves them;
    rider check-in at the lanes isn’t connected yet.
  </p>
</Card>

<SessionResults efforts={data.results} distance={Number(session.distance_metres)} />

{#if data.detail.canManage && session.status === 'planned'}
  <Card title="Edit plan">
    <form method="POST" action="?/update" class="stack">
      <input type="hidden" name="version" value={session.version} />
      <SessionFields {session} />
      <div><Button type="submit" variant="primary">Save changes</Button></div>
    </form>
    <details>
      <summary>Close or cancel this session</summary>
      <p class="note">
        Locks the plan. It doesn’t record a run or send anything to equipment, and it can’t be
        reopened.
      </p>
      <form method="POST" action="?/finish" class="stack">
        <input type="hidden" name="version" value={session.version} />
        <label class="checkbox-label">
          <input type="checkbox" name="confirm" value="yes" required />I want to end this session
          plan
        </label>
        <div class="row">
          <Button type="submit" name="status" value="closed">Close session</Button>
          <Button type="submit" variant="danger" name="status" value="cancelled">
            Cancel session
          </Button>
        </div>
      </form>
    </details>
  </Card>
{:else if session.status !== 'planned'}
  <p class="note">This session is finished and read-only. Plan a new session for the next one.</p>
{/if}

<Card title="Who can take part">
  {#if session.activity === 'free_ride'}
    <p>
      <strong>Open practice.</strong> Any active rider with a valid tag from this club can scan in at
      a free lane. No list to prepare, and each lane runs on its own.
    </p>
  {:else}
    <p>
      <strong>Coached session.</strong> Only riders on the list below can check in. They still scan at
      their lane for every effort.
    </p>
  {/if}
  {#if data.detail.isAdmin && session.status === 'planned'}
    <form method="POST" action="?/activity" class="stack">
      <input type="hidden" name="version" value={session.version} />
      <ChoiceGroup
        legend="Change type of session"
        name="activity"
        bind:value={activity}
        disabled={data.participants.total > 0}
        options={[
          { value: 'coached', label: 'Coached session' },
          { value: 'free_ride', label: 'Open practice' }
        ]}
        hint={data.participants.total > 0
          ? 'Remove every rider from the list first. Riders are never removed automatically.'
          : 'Start type and distance stay as they are.'}
      />
      <div>
        <Button
          type="submit"
          disabled={data.participants.total > 0 || activity === session.activity}
        >
          Save type
        </Button>
      </div>
    </form>
  {/if}
</Card>

{#if session.activity !== 'free_ride'}
  <SessionParticipants
    {session}
    isAdmin={data.detail.isAdmin}
    participants={data.participants}
    candidates={data.candidates}
    query={data.participantFilters.query}
  />
{/if}

{#if data.detail.isAdmin}
  <Card title="Coaches for this session">
    <p class="note">
      Coaches see the names of riders in this session — not tags, the full club register or rider
      history.
    </p>
    {#each data.detail.coaches as coach (coach.coach_user_id)}
      <div class="coach">
        <span>
          <strong>{coach.email}</strong>
          <span class="block note">{coach.can_manage ? 'Can edit and close' : 'View only'}</span>
        </span>
        <form method="POST" action="?/remove">
          <input type="hidden" name="userId" value={coach.coach_user_id} />
          <Button
            type="submit"
            variant="quiet"
            aria-label={`Remove ${coach.email} from this session`}
          >
            Remove
          </Button>
        </form>
      </div>
    {:else}
      <EmptyState title="No coach assigned yet" />
    {/each}

    {#if session.status === 'planned' && data.directory}
      <h3>Add a coach or change their access</h3>
      {#if data.directory.coaches.length}
        <form method="POST" action="?/assign" class="assign">
          <label>
            Coach<select name="userId">
              {#each data.directory.coaches as coach (coach.user_id)}
                <option value={coach.user_id}>{coach.email}</option>
              {/each}
            </select>
          </label>
          <label>
            Access<select name="manage">
              <option value="no">View only</option>
              <option value="yes">Can edit and close</option>
            </select>
          </label>
          <Button type="submit" variant="primary">Save</Button>
        </form>
        {#if data.directory.pages > 1}
          <nav class="pagination" aria-label="Coach pages">
            {#if data.directory.page > 1}<Button href={`?coachesPage=${data.directory.page - 1}`}>
                Previous coaches
              </Button>{/if}
            <span>Page {data.directory.page} of {data.directory.pages}</span>
            {#if data.directory.page < data.directory.pages}<Button
                href={`?coachesPage=${data.directory.page + 1}`}
              >
                Next coaches
              </Button>{/if}
          </nav>
        {/if}
      {:else}
        <EmptyState title="No approved coaches yet">
          Invite a coach from Coaches & access. They need to accept before you can add them here.
        </EmptyState>
      {/if}
      <a href={`/club/${session.club_id}/coaches`}>Manage club coaches</a>
    {/if}
  </Card>
{/if}

<Card title="History">
  {#each data.detail.audit as item (item.id)}
    <p class="event">
      {item.action.replaceAll('_', ' ')}<small class="block">{sessionDate(item.created_at)}</small>
    </p>
  {:else}
    <EmptyState title="No changes yet" />
  {/each}
  <p class="note">Latest 20 changes.</p>
</Card>

<style>
  .chips,
  .row {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .facts {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1rem;
  }
  .facts dt {
    font-size: 0.8125rem;
    color: var(--muted);
  }
  .facts dd {
    margin: 0;
    font: 700 1.75rem/1.1 var(--font-display);
    text-transform: uppercase;
  }
  .facts dd.when {
    font: 600 1rem/1.4 var(--font-body);
    text-transform: none;
  }
  .note {
    font-size: 0.875rem;
    color: var(--muted);
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin: 0;
  }
  details {
    margin: 0;
  }
  .coach {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.9rem;
    border-radius: var(--radius);
    background: var(--raised);
  }
  .coach form {
    margin: 0;
  }
  h3 {
    margin: 0.5rem 0 0;
    font-size: 1rem;
  }
  .assign {
    display: flex;
    gap: 0.75rem;
    align-items: flex-end;
    flex-wrap: wrap;
    margin: 0;
  }
  .assign label {
    flex: 1 1 200px;
    margin: 0;
    font-size: 0.875rem;
    color: var(--muted);
  }
  .pagination {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }
  @media (max-width: 640px) {
    .facts {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
