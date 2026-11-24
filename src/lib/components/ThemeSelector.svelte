<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  let { value = 'system' } = $props();
  // Without JavaScript the Apply button submits; with it, choosing applies straight away.
  let enhanced = $state(false);
  onMount(() => (enhanced = true));
</script>

<form method="POST" action="/preferences" class="theme-picker">
  <input type="hidden" name="returnTo" value={page.url.pathname + page.url.search} />
  <label>
    <span class="visually-hidden">Appearance</span>
    <select
      name="theme"
      {value}
      onchange={(e) => enhanced && e.currentTarget.form?.requestSubmit()}
    >
      <option value="system">Match device</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>
  {#if !enhanced}<button type="submit">Apply</button>{/if}
</form>

<style>
  .theme-picker {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    margin: 0;
  }
  label {
    margin: 0;
    min-width: 0;
  }
  select {
    margin: 0;
    min-height: var(--touch);
    padding: 0 0.6rem;
    font-size: 0.875rem;
  }
  button {
    min-height: var(--touch);
    padding: 0 0.75rem;
    font-size: 0.875rem;
  }
</style>
