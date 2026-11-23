<script lang="ts">
  import SessionList from '#lib/components/SessionList.svelte';
  let { data } = $props();
</script>

<svelte:head><title>My sessions · JNS SPLIT</title></svelte:head>
<main class="account-page wide">
  <h1>My assigned sessions</h1>
  <p>
    Only sessions explicitly assigned to you appear here. A club link alone does not grant session
    access.
  </p>
  <a class="text-link" href="/coach">Back to coach workspace</a>
  <section class="panel"><SessionList list={data.list} status={data.filters.status} /></section>
</main>
