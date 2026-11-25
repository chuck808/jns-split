<script lang="ts">
  import type { TrainingSession } from '#lib/training-sessions';
  import ChoiceGroup from '#lib/ui/ChoiceGroup.svelte';
  /** locked: results are recorded, so distance and start type can't change. */
  let { session, locked = false }: { session?: TrainingSession; locked?: boolean } = $props();
  // Writable deriveds: follow the saved session, and can be changed locally.
  let mode = $derived(session?.start_mode ?? 'standing');
  let lanes = $derived(String(session?.lane_count ?? 4));
</script>

<div class="fields">
  <label class="span-2">
    Session name<input
      name="name"
      value={session?.name ?? ''}
      maxlength="100"
      required
      placeholder="e.g. Thursday sprints"
    />
  </label>
  <label>
    Start date and time (UTC, optional)<input
      type="datetime-local"
      name="scheduled"
      value={session?.scheduled_at ? new Date(session.scheduled_at).toISOString().slice(0, 16) : ''}
    />
  </label>
  <label>
    Distance (metres)<input
      name="distance"
      type="number"
      min="0.001"
      max="10000"
      step="any"
      inputmode="decimal"
      value={session?.distance_metres ?? 20}
      required
      readonly={locked}
      aria-describedby={locked ? 'locked-note' : undefined}
    />
  </label>
  {#if locked}<input type="hidden" name="mode" value={mode} />{/if}
  <ChoiceGroup
    legend="Start type"
    name={locked ? 'mode-locked' : 'mode'}
    bind:value={mode}
    disabled={locked}
    options={[
      { value: 'standing', label: 'Standing' },
      { value: 'flying', label: 'Flying' }
    ]}
    hint={locked
      ? 'Locked: results have been recorded at this setting.'
      : mode === 'flying'
        ? 'Time starts when the rider crosses the start beam.'
        : 'Time starts from the countdown at each start post.'}
  />
  <ChoiceGroup
    legend="Lanes"
    name="lanes"
    bind:value={lanes}
    options={['1', '2', '3', '4'].map((n) => ({ value: n, label: n }))}
  />
</div>
{#if locked}<p class="caption" id="locked-note">
    Results have been recorded, so distance and start type are locked. Plan a new session to ride a
    different setup.
  </p>{/if}
<p class="caption">
  Times are in UTC for now. Saving creates a plan — nothing is sent to equipment.
</p>

<style>
  .fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem 1.25rem;
  }
  .fields label {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--muted);
  }
  .span-2 {
    grid-column: span 2;
  }
  @media (max-width: 640px) {
    .fields {
      grid-template-columns: minmax(0, 1fr);
    }
    .span-2 {
      grid-column: auto;
    }
  }
</style>
