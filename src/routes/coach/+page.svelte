<script lang="ts">
  import Button from '#lib/ui/Button.svelte';
  import Card from '#lib/ui/Card.svelte';
  import CardGrid from '#lib/ui/CardGrid.svelte';
  import EmptyState from '#lib/ui/EmptyState.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import StatusChip from '#lib/ui/StatusChip.svelte';
  let { data, form } = $props();
  const date = (v: string) => new Date(v).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
</script>

<svelte:head><title>Coach · JNS SPLIT</title></svelte:head>

<PageHeader eyebrow="Coach" title="Your sessions">
  {#snippet actions()}
    <Button variant="primary" href="/coach/sessions">My assigned sessions</Button>
  {/snippet}
</PageHeader>

{#if form?.message}<p class="feedback" class:error={!form.ok} role="status">{form.message}</p>{/if}
{#if !data.workspace.emailConfirmed}<p class="notice">
    Your account email must be confirmed before you can view or accept invitations. Contact the
    project owner.
  </p>{/if}

<CardGrid columns={2}>
  <Card title="Invitations" tone={data.workspace.invitations.length ? 'highlight' : 'default'}>
    {#each data.workspace.invitations as invite (invite.id)}
      <article class="item">
        <h3>{invite.club_name}</h3>
        <p>Accept to link with this club. Sessions and rider history need separate permission.</p>
        <p class="meta">Expires {date(invite.expires_at)}</p>
        <form method="POST" class="choices">
          <input type="hidden" name="invitationId" value={invite.id} />
          <Button type="submit" variant="primary" name="choice" value="accept">Accept</Button>
          <Button type="submit" name="choice" value="decline">Decline</Button>
        </form>
      </article>
    {:else}
      <EmptyState title="No invitations waiting">
        Invitations that expire, are withdrawn or have been answered no longer appear here.
      </EmptyState>
    {/each}
  </Card>

  <Card title="Your clubs">
    {#each data.workspace.clubs as club (club.id)}
      <article class="item">
        <div class="row">
          <h3>{club.name}</h3>
          <StatusChip tone="success">Coach link approved</StatusChip>
        </div>
        <p class="meta">
          You see sessions this club assigns to you — not the club's whole register.
        </p>
      </article>
    {:else}
      <EmptyState title="No club links yet">
        Ask a club administrator to invite the email address you sign in with.
      </EmptyState>
    {/each}
  </Card>
</CardGrid>

<style>
  .item {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.9rem;
    border-radius: var(--radius);
    background: var(--raised);
  }
  .item h3 {
    margin: 0;
    font-size: 1rem;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .meta {
    font-size: 0.875rem;
    color: var(--muted);
  }
  .choices {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
</style>
