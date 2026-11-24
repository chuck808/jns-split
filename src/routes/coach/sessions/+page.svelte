<script lang="ts">
  import SessionList from '#lib/components/SessionList.svelte';
  import Card from '#lib/ui/Card.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  let { data } = $props();
</script>

<svelte:head><title>My sessions · JNS SPLIT</title></svelte:head>
<PageHeader
  eyebrow="Coach"
  title="My sessions"
  description="Sessions a club has assigned to you. Being linked to a club doesn’t show you all of its sessions."
/>
<Card>
  <SessionList list={data.list} status={data.filters.status} showClub />
</Card>
