<script lang="ts">
  import { needsBirthDate, type RiderSettings } from '#lib/rider-details';
  /** Year (or date) of birth plus the club's extra fields, for register and edit forms. */
  let {
    settings,
    birthYear = null,
    birthDate = null,
    values = {}
  }: {
    settings: RiderSettings;
    birthYear?: number | null;
    birthDate?: string | null;
    values?: Record<string, string>;
  } = $props();
  const thisYear = new Date().getFullYear();
</script>

{#if needsBirthDate(settings)}
  <label>
    Date of birth<input
      name="birthDate"
      type="date"
      required
      max={new Date().toISOString().slice(0, 10)}
      value={birthDate ?? ''}
    />
  </label>
{:else}
  <label>
    Year of birth<input
      name="birthYear"
      type="number"
      required
      min="1900"
      max={thisYear}
      step="1"
      inputmode="numeric"
      placeholder={`e.g. ${thisYear - 11}`}
      value={birthYear ?? ''}
    />
  </label>
{/if}
{#each settings.fields as field (field.id)}
  <label>
    {field.label}{field.required ? '' : ' (optional)'}<input
      name={`field:${field.id}`}
      maxlength="100"
      required={field.required}
      autocomplete="off"
      value={values[field.id] ?? ''}
    />
  </label>
{/each}

<style>
  label {
    margin: 0;
    font-size: 0.875rem;
    color: var(--muted);
  }
</style>
