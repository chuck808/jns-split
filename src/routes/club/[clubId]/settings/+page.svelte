<script lang="ts">
  import { AGE_RULES, SCOREBOARD_NAMES } from '#lib/rider-details';
  import Button from '#lib/ui/Button.svelte';
  import Card from '#lib/ui/Card.svelte';
  import ChoiceGroup from '#lib/ui/ChoiceGroup.svelte';
  import EmptyState from '#lib/ui/EmptyState.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import StatusChip from '#lib/ui/StatusChip.svelte';
  let { data, form } = $props();
  const s = $derived(data.riderSettings);
  let unit = $derived(data.club.speed_unit as string);
  let ageRule = $derived(s.age_rule as string);
  let scoreboard = $derived(s.scoreboard_name as string);
  let under = $derived(s.guardian_only_under);
  let from = $derived(s.rider_from);
  const feedback = (section: string) => (form?.section === section ? form : null);
</script>

<svelte:head><title>Settings · {data.club.name} · JNS SPLIT</title></svelte:head>

<PageHeader eyebrow={data.club.name} title="Settings" />

<Card title="Club details">
  <form method="POST" action="?/club" class="stack">
    <label>
      Club name<input name="name" value={data.club.name} required maxlength="100" />
    </label>
    <ChoiceGroup
      legend="Show speeds in"
      name="unit"
      bind:value={unit}
      options={[
        { value: 'km/h', label: 'km/h' },
        { value: 'mph', label: 'mph' }
      ]}
      hint="Used for future recorded sessions. Existing measurements and the bench simulator are unchanged."
    />
    {#if feedback('club')}<p class="feedback" class:error={!form?.ok} role="status">
        {form?.message}
      </p>{/if}
    <div><Button type="submit" variant="primary">Save club details</Button></div>
  </form>
</Card>

<Card title="Rider details">
  <p class="note">
    Every rider needs a display name and year of birth. These settings decide what else you ask for,
    and how riders appear.
  </p>
  <form method="POST" action="?/riders" class="stack">
    <ChoiceGroup
      legend="Age groups are worked out from"
      name="ageRule"
      variant="cards"
      bind:value={ageRule}
      options={AGE_RULES}
    />
    {#if ageRule === 'season_31_aug' && s.age_rule !== 'season_31_aug'}
      <p class="notice">
        From now on, new riders will need a full date of birth. Riders already registered keep their
        year of birth until you edit them.
      </p>
    {/if}

    <fieldset class="bands">
      <legend>Who gets the invitation to see a rider’s results</legend>
      <div class="band-row">
        <label>
          Guardian only, under<input
            name="guardianOnlyUnder"
            type="number"
            min="0"
            max="21"
            step="1"
            inputmode="numeric"
            bind:value={under}
            required
          />
        </label>
        <label>
          The rider, from age<input
            name="riderFrom"
            type="number"
            min="0"
            max="21"
            step="1"
            inputmode="numeric"
            bind:value={from}
            required
          />
        </label>
      </div>
      <p class="hint">
        Under {under}: guardian only. {under}–{Math.max(under, from - 1)}: you choose. {from} and over:
        the rider. The UK preset is 13 and 18 — check your country’s rules and your governing body’s guidance
        before changing it. Used when family invitations are switched on.
      </p>
    </fieldset>

    <ChoiceGroup
      legend="Names on the scoreboard, until a family chooses"
      name="scoreboardName"
      bind:value={scoreboard}
      options={SCOREBOARD_NAMES.map((n) => ({ value: n.value, label: n.label }))}
      hint={`For example: ${SCOREBOARD_NAMES.find((n) => n.value === scoreboard)?.example ?? ''}`}
    />
    {#if feedback('riders')}<p class="feedback" class:error={!form?.ok} role="status">
        {form?.message}
      </p>{/if}
    <div><Button type="submit" variant="primary">Save rider settings</Button></div>
  </form>
</Card>

<Card title="Your club’s extra fields">
  <p class="note">
    Up to two, for things like a British Cycling licence number. They point to your own records and
    are never used to identify a rider.
  </p>
  {#each s.fields as field (field.id)}
    <div class="field">
      <form method="POST" action="?/field" class="field-form">
        <input type="hidden" name="fieldId" value={field.id} />
        <label class="grow">
          Field name<input name="label" value={field.label} required maxlength="60" />
        </label>
        <label class="checkbox-label">
          <input type="checkbox" name="required" value="yes" checked={field.required} />Required
        </label>
        <Button type="submit">Save</Button>
      </form>
      <details>
        <summary>Remove this field</summary>
        <form method="POST" action="?/removeField" class="stack">
          <input type="hidden" name="fieldId" value={field.id} />
          <label class="checkbox-label">
            <input type="checkbox" name="confirm" value="yes" required />Remove “{field.label}”.
            Values already recorded are kept but no longer shown.
          </label>
          <div><Button type="submit" variant="danger">Remove field</Button></div>
        </form>
      </details>
    </div>
  {:else}
    <EmptyState title="No extra fields yet" />
  {/each}

  {#if s.fields.length < 2}
    <form method="POST" action="?/field" class="field-form add">
      <label class="grow">
        New field name<input
          name="label"
          required
          maxlength="60"
          placeholder="e.g. British Cycling licence"
        />
      </label>
      <label class="checkbox-label">
        <input type="checkbox" name="required" value="yes" />Required
      </label>
      <Button type="submit" variant="primary">Add field</Button>
    </form>
  {:else}
    <p><StatusChip>2 of 2 fields used</StatusChip></p>
  {/if}
  {#if feedback('fields')}<p class="feedback" class:error={!form?.ok} role="status">
      {form?.message}
    </p>{/if}
</Card>

<style>
  .stack {
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
    margin: 0;
  }
  .stack > label,
  .field-form label,
  .band-row label {
    margin: 0;
    font-size: 0.875rem;
    color: var(--muted);
  }
  .note,
  .hint {
    margin: 0;
    font-size: 0.875rem;
    color: var(--muted);
  }
  .bands {
    border: 0;
    margin: 0;
    padding: 0;
  }
  .bands legend {
    padding: 0;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--muted);
  }
  .band-row {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    margin-bottom: 0.5rem;
  }
  .band-row label {
    flex: 0 1 180px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.8rem 0.9rem;
    border-radius: var(--radius);
    background: var(--raised);
  }
  .field details {
    margin: 0;
  }
  .field-form {
    display: flex;
    gap: 0.75rem;
    align-items: flex-end;
    flex-wrap: wrap;
    margin: 0;
  }
  .field-form .grow {
    flex: 1 1 240px;
  }
  .field-form .checkbox-label {
    flex: 0 0 auto;
    align-self: center;
  }
  .add {
    padding-top: 0.25rem;
  }
</style>
