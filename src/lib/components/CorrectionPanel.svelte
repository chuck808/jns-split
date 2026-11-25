<script lang="ts">
  import Button from '#lib/ui/Button.svelte';
  import Card from '#lib/ui/Card.svelte';
  import ChoiceGroup from '#lib/ui/ChoiceGroup.svelte';
  import { formatTime } from '#lib/ui/format';
  import { OUTCOME_LABELS, seconds, type CorrectionPanel } from '#lib/results';

  /** One effort's correction form and history. The original effort is never changed. */
  let { panel, closeHref }: { panel: CorrectionPanel; closeHref: string } = $props();
  const e = $derived(panel.effort);
  const isInvalid = $derived(e.outcome === 'invalid' && !!e.corrected);
  let action = $derived(isInvalid ? 'move' : 'invalid');
  const when = (iso: string) =>
    new Date(iso).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/London'
    });
  const describe = (h: { invalid: boolean; rider_name: string | null }) =>
    h.invalid && h.rider_name
      ? `Marked invalid, moved to ${h.rider_name}`
      : h.invalid
        ? 'Marked invalid'
        : h.rider_name
          ? `Moved to ${h.rider_name}`
          : 'Back to the original';
  const options = $derived([
    ...(isInvalid
      ? []
      : [
          {
            value: 'invalid',
            label: 'Mark invalid',
            description: 'For example a false start. It stays listed but never counts.'
          }
        ]),
    ...(panel.candidates.length
      ? [
          {
            value: 'move',
            label: 'Move to another rider',
            description: 'A tag mix-up: someone else rode this effort.'
          }
        ]
      : []),
    ...(e.corrected
      ? [
          {
            value: 'restore',
            label: 'Restore the original',
            description: 'Undo the corrections. They stay in the history.'
          }
        ]
      : [])
  ]);
</script>

<Card title="Correct a result" tone="highlight">
  <p class="what">
    <strong>{e.rider_name}</strong> ·
    {e.elapsed_ms !== null ? `${formatTime(seconds(e.elapsed_ms))}s` : OUTCOME_LABELS[e.outcome]} in lane
    {e.lane} at {when(e.recorded_at)}
    {#if e.original_rider_name}<span class="note">
        (measured on {e.original_rider_name}’s tag)
      </span>{/if}
    {#if isInvalid}<span class="note">· currently invalid</span>{/if}
  </p>
  <p class="note">
    The measured result is never changed or deleted. A correction is added on top, with your name
    and reason, and can be undone.
  </p>

  {#if options.length}
    <form method="POST" action="?/correct" class="stack">
      <input type="hidden" name="effortId" value={e.id} />
      <ChoiceGroup
        legend="What happened?"
        name="action"
        variant="cards"
        bind:value={action}
        {options}
      />
      {#if action === 'move'}
        <label>
          Who actually rode it?
          <select name="riderId" required>
            <option value="">Choose a rider</option>
            {#each panel.candidates as c (c.rider_id)}
              <option value={c.rider_id}>{c.display_name}</option>
            {/each}
          </select>
        </label>
        <p class="note">Only riders on this session’s list, or who rode in it, can be chosen.</p>
      {/if}
      <label>
        Reason{action === 'restore' ? ' (optional)' : ''}
        <input
          name="reason"
          maxlength="200"
          required={action !== 'restore'}
          placeholder={action === 'move'
            ? 'e.g. Sam rode on Alex’s tag'
            : 'e.g. False start: rolled the gate'}
        />
      </label>
      <p class="note">
        Seen by this session’s coaches and club admins. Families only see “Invalid”.
      </p>
      <div class="actions">
        <Button type="submit" variant="primary">Save correction</Button>
        <Button href={closeHref} variant="quiet">Cancel</Button>
      </div>
    </form>
  {:else}
    <p>Nothing else to change here.</p>
    <Button href={closeHref}>Close</Button>
  {/if}

  {#if panel.history.length}
    <h3>History</h3>
    <ol class="history">
      {#each panel.history as h (h.seq)}
        <li>
          <span>{describe(h)} — “{h.reason}”</span>
          <span class="note">{h.by_email} · {when(h.created_at)}</span>
        </li>
      {/each}
    </ol>
  {/if}
</Card>

<style>
  .what {
    margin: 0;
  }
  .note {
    font-size: 0.875rem;
    color: var(--muted);
    margin: 0;
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin: 1rem 0 0;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  h3 {
    margin: 1.25rem 0 0.5rem;
    font-size: 1rem;
  }
  .history {
    margin: 0;
    padding-left: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .history li {
    display: flex;
    flex-direction: column;
  }
</style>
