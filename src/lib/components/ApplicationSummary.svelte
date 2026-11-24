<script lang="ts">
  import type { ApplicationDetail } from '#lib/club-admission';
  import { sessionDate } from '#lib/training-sessions';
  import Button from '#lib/ui/Button.svelte';
  import Card from '#lib/ui/Card.svelte';
  import ApplicationStatus from './ApplicationStatus.svelte';
  let { detail }: { detail: ApplicationDetail } = $props();
  let app = $derived(detail.application);
</script>

<Card title={app.club_name}>
  <div><ApplicationStatus status={app.status} /></div>
  <dl class="facts">
    <div>
      <dt>Sport</dt>
      <dd>{app.sport}</dd>
    </div>
    <div>
      <dt>Town or region</dt>
      <dd>{app.town}</dd>
    </div>
    <div>
      <dt>Applicant</dt>
      <dd>{app.applicant_name}</dd>
    </div>
    <div>
      <dt>Verified contact email</dt>
      <dd>{app.contact_email}</dd>
    </div>
    <div>
      <dt>Submitted</dt>
      <dd>{sessionDate(app.created_at)}</dd>
    </div>
    {#if app.decided_at}<div>
        <dt>Decided or withdrawn</dt>
        <dd>{sessionDate(app.decided_at)}</dd>
      </div>{/if}
  </dl>
  {#if app.decision_reason}
    <div class="reason">
      <span class="label">Reason given</span>
      <p>{app.decision_reason}</p>
    </div>
  {/if}
  {#if app.status === 'approved' && detail.isApplicant && app.club_id}
    <div><Button variant="primary" href={`/club/${app.club_id}`}>Open your club</Button></div>
  {/if}
</Card>

<Card title="History">
  {#each detail.events as event, i (i)}
    <p class="event">{event.action}<small class="block">{sessionDate(event.created_at)}</small></p>
  {/each}
</Card>

<style>
  .facts {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.9rem 1.5rem;
  }
  dt {
    font-size: 0.8125rem;
    color: var(--muted);
  }
  dd {
    margin: 0;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .reason {
    padding: 0.8rem 1rem;
    border-radius: var(--radius);
    background: var(--raised);
  }
  .label {
    font-size: 0.8125rem;
    color: var(--muted);
  }
  .reason p {
    margin: 0.2rem 0 0;
    color: var(--text);
  }
  @media (max-width: 640px) {
    .facts {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
