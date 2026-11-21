<script lang="ts">
  import SessionFields from '#lib/components/SessionFields.svelte';
  import SessionParticipants from '#lib/components/SessionParticipants.svelte';
  import { sessionDate, activityLabel } from '#lib/training-sessions';
  let { data, form } = $props();
  let session = $derived(data.detail.session);
</script>

<svelte:head><title>{session.name} · JNS SPLIT</title></svelte:head>
<main class="account-page wide">
  <span class="eyebrow">{data.detail.clubName}</span>
  <h1>{session.name}</h1>
  <a
    class="text-link"
    href={data.detail.isAdmin ? `/club/${session.club_id}/sessions` : '/coach/sessions'}
  >
    Back to sessions
  </a>
  <div class="notice">
    <strong>Session planning</strong><span>
      No hardware controls, rider check-in or measured results are enabled here yet.
    </span>
  </div>
  {#if form?.message}<p class="feedback" class:error={!form.ok} role="status">
      {form.message}
    </p>{/if}
  <section class="panel">
    <h2>Session details</h2>
    <p><strong>{activityLabel(session.activity)}</strong></p>
    <p>Status: <strong>{session.status}</strong> · {sessionDate(session.scheduled_at)}</p>
    <p>
      {session.distance_metres} metres · {session.start_mode} start · {session.lane_count} lanes
    </p>
    <p>
      Your permission: {data.detail.isAdmin
        ? 'Club administrator'
        : data.detail.canManage
          ? 'Edit and close this session'
          : 'View this session only'}.
    </p>
    {#if data.detail.canManage && session.status === 'planned'}<form
        method="POST"
        action="?/update"
      >
        <input type="hidden" name="version" value={session.version} /><SessionFields
          {session}
        /><button class="solid">Save session plan</button>
      </form>
      <details>
        <summary>Close or cancel session</summary>
        <p>
          This ends planning and locks the configuration. It does not record a run or send any
          equipment command. It cannot be reopened in this pilot.
        </p>
        <form method="POST" action="?/finish">
          <input type="hidden" name="version" value={session.version} /><label
            class="checkbox-label"
          >
            <input type="checkbox" name="confirm" value="yes" required />Confirm ending this session
            plan
          </label><button name="status" value="closed">Close session</button><button
            name="status"
            value="cancelled"
          >
            Cancel session
          </button>
        </form>
      </details>{:else if session.status !== 'planned'}<p>
        This session is read-only. Create a new plan for another session.
      </p>{/if}
  </section>
  <section class="panel">
    <h2>Session activity and admission</h2>
    {#if session.activity === 'free_ride'}
      <p>
        Open club practice: active riders with valid tags from this club will be able to scan at an
        available lane without advance enrolment. Each lane runs independently.
      </p>
      <p>
        No participant list needs preparing. Automatic participation and lane check-in await
        controller integration; this is a saved plan only.
      </p>
    {:else}
      <p>
        Coached session: prepare a participant list below. Each effort will still use a rider's lane
        scan.
      </p>
    {/if}
    {#if data.detail.isAdmin && session.status === 'planned'}
      <form method="POST" action="?/activity">
        <input type="hidden" name="version" value={session.version} />
        <label>
          Session activity<select name="activity" value={session.activity}>
            <option value="coached">Coached session</option><option value="free_ride">
              Free ride · open club practice
            </option>
          </select>
        </label>
        <p>
          Changing activity requires an empty participant list. Existing riders are never removed
          automatically. Start type and distance remain separate settings.
        </p>
        <button disabled={data.participants.total > 0}>Save activity</button>
      </form>
    {/if}
  </section>
  {#if session.activity !== 'free_ride'}
    <SessionParticipants
      {session}
      isAdmin={data.detail.isAdmin}
      participants={data.participants}
      candidates={data.candidates}
      query={data.participantFilters.query}
    />
  {/if}

  {#if data.detail.isAdmin}<section class="panel">
      <h2>Session coaches</h2>
      <p>
        Permission includes this session’s participant names. It does not expose tags, the full club
        register or rider history.
      </p>
      {#each data.detail.coaches as coach}<p>
          {coach.email} · {coach.can_manage ? 'Can edit and close' : 'View only'}
        </p>
        <form method="POST" action="?/remove">
          <input type="hidden" name="userId" value={coach.coach_user_id} /><button>
            Remove session access for {coach.email}
          </button>
        </form>{:else}<p>No coaches assigned.</p>{/each}
      {#if session.status === 'planned' && data.directory}<h3>
          Assign or change a coach’s permission
        </h3>
        {#if data.directory.coaches.length}<form method="POST" action="?/assign">
            <label>
              Approved coach<select name="userId">
                {#each data.directory.coaches as coach}<option value={coach.user_id}>
                    {coach.email}
                  </option>{/each}
              </select>
            </label><label>
              Session permission<select name="manage">
                <option value="no">View only</option><option value="yes">
                  Edit configuration and close/cancel this session
                </option>
              </select>
            </label><button class="solid">Save coach permission</button>
          </form>{:else}<p>
            No approved coaches available. Invite a coach and ask them to accept first.
          </p>{/if}
        <nav class="pagination" aria-label="Approved coach pages">
          {#if data.directory.page > 1}<a href={`?coachesPage=${data.directory.page - 1}`}>
              Previous coaches
            </a>{/if}<span>
            Page {data.directory.page} of {data.directory.pages}
          </span>{#if data.directory.page < data.directory.pages}<a
              href={`?coachesPage=${data.directory.page + 1}`}
            >
              Next coaches
            </a>{/if}
        </nav>
        <a class="text-link" href={`/club/${session.club_id}/coaches`}>Manage club coaches</a>{/if}
    </section>{/if}
  <section class="panel">
    <h2>Session activity</h2>
    <p>Latest 20 changes.</p>
    {#each data.detail.audit as item}<p class="event">
        {item.action.replaceAll('_', ' ')}<small class="block">
          {sessionDate(item.created_at)}
        </small>
      </p>{/each}
  </section>
</main>
