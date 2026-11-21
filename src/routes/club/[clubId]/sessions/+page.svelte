<script lang="ts">
  import SessionFields from '#lib/components/SessionFields.svelte';
  import SessionList from '#lib/components/SessionList.svelte';
  let { data, form } = $props();
</script>

<svelte:head><title>Sessions · {data.club.name} · JNS SPLIT</title></svelte:head>
<h1>Sessions</h1>
<div class="notice">
  Planning only: no hardware commands or measured results are recorded here yet.
</div>
<section class="panel">
  <h2>Create a session</h2>
  <form method="POST"><SessionFields /><button class="solid">Create session plan</button></form>
  {#if form?.message}<p class="feedback error" role="alert">{form.message}</p>{/if}
</section>
<section class="panel">
  <h2>Club sessions</h2>
  <SessionList list={data.list} status={data.filters.status} />
</section>
