<script lang="ts">
  import Button from '#lib/ui/Button.svelte';
  import Card from '#lib/ui/Card.svelte';
  import ChoiceGroup from '#lib/ui/ChoiceGroup.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  let { data, form } = $props();
  let unit = $derived(data.club.speed_unit as string);
</script>

<svelte:head><title>Settings · {data.club.name} · JNS SPLIT</title></svelte:head>

<PageHeader eyebrow={data.club.name} title="Settings" />

<Card title="Club details">
  <form method="POST" class="stack">
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
    {#if form?.message}<p class="feedback" class:error={!form.ok} role="status">
        {form.message}
      </p>{/if}
    <div><Button type="submit" variant="primary">Save settings</Button></div>
  </form>
</Card>

<p class="caption">
  Rider details, age groups and who receives invitations will be set here in a later release.
</p>

<style>
  .stack {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin: 0;
    max-width: 560px;
  }
  .stack label {
    margin: 0;
    font-size: 0.875rem;
    color: var(--muted);
  }
</style>
