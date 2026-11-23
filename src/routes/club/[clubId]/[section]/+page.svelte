<script lang="ts">
  let { data } = $props();
</script>

<svelte:head><title>{data.section.title} · JNS SPLIT</title></svelte:head>
<h1>{data.section.title}</h1>
<section class="panel">
  <span class="pill">Upcoming</span>
  <p>{data.section.description}</p>
  <a class="text-link" href={`/club/${data.club.id}`}>Back to club overview</a>
</section>
