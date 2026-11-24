<script lang="ts">
  import Button from '#lib/ui/Button.svelte';
  import Card from '#lib/ui/Card.svelte';
  import CardGrid from '#lib/ui/CardGrid.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  let { data, form } = $props();
</script>

<svelte:head><title>Choose a workspace · JNS SPLIT</title></svelte:head>
<div class="chooser">
  <PageHeader eyebrow={`Signed in as ${data.email}`} title="Where to?" />
  {#if form?.message}<p class="feedback error" role="alert">{form.message}</p>{/if}

  {#if data.items.length}
    <CardGrid columns={data.items.length > 2 ? 3 : 2}>
      {#each data.items as workspace (workspace.key)}
        <Card title={workspace.label}>
          <p>{workspace.description}</p>
          <form method="POST">
            <input type="hidden" name="workspace" value={workspace.key} />
            <Button type="submit" variant="primary">Open</Button>
          </form>
        </Card>
      {/each}
    </CardGrid>
    <p class="caption">
      Only workspaces you’ve been given access to are shown. Switching changes the view, not your
      access — you can also switch from the account menu at any time.
    </p>
  {:else}
    <Card title="Nothing linked to this account yet">
      <p>
        Ask your club administrator to invite the email address you sign in with. You can’t give
        yourself a role.
      </p>
      <div class="links">
        <Button href="/coach">Check coach invitations</Button>
        <Button href="/clubs/request">Register a club</Button>
      </div>
      <p class="caption">A new club needs platform approval before you can manage it.</p>
    </Card>
  {/if}

  <nav class="links" aria-label="Account">
    <a href="/clubs/request">Your club applications</a>
    <a href="/account">Account settings</a>
  </nav>
</div>

<style>
  .chooser {
    max-width: 1000px;
    margin: 0 auto;
    padding: 2.5rem 1.5rem 3rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .links {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    align-items: center;
  }
</style>
