<script lang="ts">
  import Button from '#lib/ui/Button.svelte';
  import Card from '#lib/ui/Card.svelte';
  import ChoiceGroup from '#lib/ui/ChoiceGroup.svelte';
  import EmptyState from '#lib/ui/EmptyState.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import StatusChip from '#lib/ui/StatusChip.svelte';
  import { activityLabel } from '#lib/training-sessions';
  let { data, form } = $props();
  let mode = $state('test');
  const day = (value: string) =>
    new Date(value).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC'
    }) + ' UTC';
  const status = (d: (typeof data.devices)[number]) =>
    d.revoked ? 'Revoked' : d.expired ? 'Expired' : 'Active';
</script>

<svelte:head><title>Timing controllers · JNS SPLIT</title></svelte:head>

<PageHeader
  eyebrow="Equipment"
  title="Timing controllers"
  description="Credentials that let timing equipment save results to your club’s sessions."
/>

{#if form?.message}<p class="feedback" class:error={!form.ok} role="status">{form.message}</p>{/if}

{#if form && 'credential' in form && form.credential}
  <Card title="Copy this credential now" tone="highlight">
    <p>
      It’s shown only once; only a fingerprint of it is stored. Keep it out of Git, screenshots and
      shared messages.
    </p>
    <label>Credential<input readonly value={form.credential} /></label>
    <label>Upload address<input readonly value={data.endpoint} /></label>
    <p class="note">
      {form.mode === 'test'
        ? 'Test credential: lasts 7 days. Its results are marked “Demo — simulated data” and never reach riders or families.'
        : 'Live credential: lasts 180 days. Its results are real: riders and families see them and they count towards bests.'}
    </p>
  </Card>
{/if}

<div class="two">
  <Card title="Add a controller">
    <form method="POST" action="?/create" class="stack">
      <label>Name<input name="name" required maxlength="60" placeholder="ST-1 start hill" /></label>
      <ChoiceGroup
        legend="Kind of results"
        name="mode"
        variant="cards"
        bind:value={mode}
        options={[
          {
            value: 'test',
            label: 'Test',
            description: 'For trying things out. Results are labelled demo and kept from riders.'
          },
          {
            value: 'live',
            label: 'Live',
            description: 'For real timing equipment only. Riders and families see these results.'
          }
        ]}
      />
      {#if mode === 'live'}
        <label class="checkbox-label">
          <input type="checkbox" name="liveConfirm" value="yes" required />This is for real timing
          equipment, not a test script or simulator.
        </label>
      {/if}
      <div><Button type="submit" variant="primary">Create credential</Button></div>
    </form>
  </Card>

  <Card title="Sending results">
    <p class="note">
      Controllers send one effort at a time to the upload address. The format is in
      <code>docs/results-upload-v1.md</code>. To try it before the hardware arrives, use a
      <strong>Test</strong> credential with <code>scripts/send-test-effort.mjs</code>.
    </p>
    {#if data.sessions?.items.length}
      <h3>Session IDs</h3>
      <ul class="sessions">
        {#each data.sessions.items as session (session.id)}
          <li>
            <a href={`/sessions/${session.id}`}>{session.name}</a>
            <span class="note">{activityLabel(session.activity)}</span>
            <code>{session.id}</code>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="note">Plan a session first: results are always saved to a planned session.</p>
    {/if}
  </Card>
</div>

<Card title="Your controllers">
  {#each data.devices as device (device.id)}
    <article class="item">
      <div class="row">
        <strong>{device.name}</strong>
        <span class="chips">
          <StatusChip tone={device.mode === 'live' ? 'success' : 'info'}>
            {device.mode === 'live' ? 'Live' : 'Test'}
          </StatusChip>
          <StatusChip tone={status(device) === 'Active' ? 'success' : 'neutral'}>
            {status(device)}
          </StatusChip>
        </span>
      </div>
      <span class="note">
        {device.efforts}
        {device.efforts === 1 ? 'effort' : 'efforts'} saved ·
        {device.last_seen_at ? `last upload ${day(device.last_seen_at)}` : 'no uploads yet'} ·
        {device.revoked || device.expired ? 'ended' : 'expires'}
        {day(device.expires_at)}
      </span>
      {#if !device.revoked && !device.expired}
        <form method="POST" action="?/revoke">
          <input type="hidden" name="deviceId" value={device.id} />
          <Button type="submit" variant="quiet">Revoke</Button>
        </form>
      {/if}
    </article>
  {:else}
    <EmptyState title="No controllers yet">
      Add a Test controller to try sending results before the timing hardware arrives.
    </EmptyState>
  {/each}
</Card>

<style>
  .two {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
    align-items: start;
    margin: 1rem 0;
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin: 0;
  }
  .note {
    font-size: 0.875rem;
    color: var(--muted);
    margin: 0;
  }
  h3 {
    margin: 1rem 0 0.5rem;
    font-size: 1rem;
  }
  .sessions {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .sessions li {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  code {
    font-size: 0.8125rem;
    overflow-wrap: anywhere;
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
  .item form {
    margin: 0;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .chips {
    display: flex;
    gap: 0.4rem;
  }
  @media (max-width: 860px) {
    .two {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
