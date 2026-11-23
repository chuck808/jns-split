<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head><title>Club settings · JNS SPLIT</title></svelte:head>
<h1>Club settings</h1>
<section class="panel">
  <form method="POST">
    <label>
      Club name<input name="name" value={data.club.name} required maxlength="100" />
    </label><label>
      Preferred speed unit<select name="unit" value={data.club.speed_unit}>
        <option value="km/h">km/h</option><option value="mph">mph</option>
      </select>
    </label>
    <p>
      This default is stored for future recorded sessions. It does not change existing measurements
      or bench simulator preferences.
    </p>
    <button class="solid">Save settings</button>
  </form>
  {#if form?.message}<p class="feedback" class:error={!form.ok} role="status">
      {form.message}
    </p>{/if}
</section>
