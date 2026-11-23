<script lang="ts">
  import type { TrainingSession } from '#lib/training-sessions';
  let { session }: { session?: TrainingSession } = $props();
</script>

<label>
  Session name<input name="name" value={session?.name ?? ''} maxlength="100" required />
</label>
<div class="form-row">
  <label>
    Scheduled start (UTC, optional)<input
      type="datetime-local"
      name="scheduled"
      value={session?.scheduled_at ? new Date(session.scheduled_at).toISOString().slice(0, 16) : ''}
    />
  </label><label>
    Distance (metres)<input
      name="distance"
      type="number"
      min="0.001"
      max="10000"
      step="any"
      value={session?.distance_metres ?? 20}
      required
    />
  </label>
</div>
<div class="form-row">
  <label>
    Start type<select name="mode" value={session?.start_mode ?? 'standing'}>
      <option value="standing">Standing start</option><option value="flying">Flying start</option>
    </select>
  </label><label>
    Lanes<select name="lanes" value={session?.lane_count ?? 4}>
      {#each [1, 2, 3, 4] as n}<option value={n}>{n}</option>{/each}
    </select>
  </label>
</div>
<p class="caption">
  Scheduling uses UTC in this pilot. Session configuration is a plan, not a command sent to
  equipment.
</p>
