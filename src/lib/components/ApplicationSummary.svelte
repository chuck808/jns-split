<script lang="ts">
  import type { ApplicationDetail } from '#lib/club-admission';
  import { sessionDate } from '#lib/training-sessions';
  let { detail }: { detail: ApplicationDetail } = $props();
  let app = $derived(detail.application);
</script>

<section class="panel">
  <h2>{app.club_name}</h2>
  <p>
    <strong>{app.status === 'submitted' ? 'Awaiting review' : app.status}</strong> · {app.sport} · {app.town}
  </p>
  <p>Applicant: {app.applicant_name}<br />Verified contact at submission: {app.contact_email}</p>
  <p>Submitted {sessionDate(app.created_at)}</p>
  {#if app.decided_at}<p>Decision / withdrawal: {sessionDate(app.decided_at)}</p>{/if}
  {#if app.decision_reason}<h3>Decision reason</h3>
    <p>{app.decision_reason}</p>{/if}
  {#if app.status === 'approved' && detail.isApplicant && app.club_id}<a
      class="solid link-button"
      href={`/club/${app.club_id}`}
    >
      Open your club
    </a>{/if}
</section>
<section class="panel">
  <h2>Application history</h2>
  {#each detail.events as event}<p>{event.action} · {sessionDate(event.created_at)}</p>{/each}
</section>
