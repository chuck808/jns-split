<script lang="ts">
  import Card from '#lib/ui/Card.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import PublicPage from '#lib/ui/PublicPage.svelte';
</script>

<svelte:head><title>Contact · JNS SPLIT</title></svelte:head>

<PublicPage>
  <PageHeader title="Contact & access" />
  <Card title="Already using JNS SPLIT with a club?">
    <p>For help with your account or equipment, contact the person who set up your access.</p>
  </Card>
  <Card title="Joining the pilot">
    <p>
      Access is arranged directly with clubs taking part in the pilot. Public sign-up and a support
      inbox aren’t open yet.
    </p>
    <p class="note">This page doesn’t collect messages.</p>
    <a href="/help">Read the getting-started guide</a>
  </Card>
</PublicPage>

<style>
  .note {
    font-size: 0.875rem;
    color: var(--muted);
  }
</style>
