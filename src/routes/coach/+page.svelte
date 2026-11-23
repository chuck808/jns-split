<script lang="ts">
  let { data, form } = $props();
  const date = (v: string) => new Date(v).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
</script>

<svelte:head><title>Coach workspace · JNS SPLIT</title></svelte:head>
<main class="account-page wide">
  <header>
    <h1>Coach workspace</h1>
    <form method="POST" action="/logout"><button>Sign out</button></form>
  </header>
  <p>Signed in as {data.email}</p>
  {#if form?.message}<p class="feedback" class:error={!form.ok} role="status">
      {form.message}
    </p>{/if}
  {#if !data.workspace.emailConfirmed}<p class="notice">
      Your account email must be confirmed before you can view or accept invitations. Contact the
      project owner.
    </p>{/if}
  <a class="solid link-button" href="/coach/sessions">My assigned sessions</a>
  <section class="panel">
    <h2>Invitations</h2>
    {#each data.workspace.invitations as invite}<article class="panel">
        <h3>{invite.club_name}</h3>
        <p>
          Accept a coach link to this club. This does not grant rider history or session controls.
        </p>
        <p>Expires {date(invite.expires_at)}</p>
        <form method="POST">
          <input type="hidden" name="invitationId" value={invite.id} /><button
            class="solid"
            name="choice"
            value="accept"
          >
            Accept invitation
          </button><button name="choice" value="decline">Decline</button>
        </form>
      </article>{:else}<p>
        No available invitations for this account. Invitations that expire, are revoked or have
        already been answered are not available here.
      </p>{/each}
  </section>
  <section class="panel">
    <h2>Your approved clubs</h2>
    {#each data.workspace.clubs as club}<article class="panel">
        <h3>{club.name}</h3>
        <span class="pill">Coach link approved</span>
        <p>
          Open My assigned sessions to see plans shared with you. Rider-history grants are not
          enabled, and your membership does not expose the club register.
        </p>
      </article>{:else}<p>
        You have no approved coach links yet. Ask a club administrator to invite your account email.
      </p>{/each}
  </section>
  <a class="text-link" href="/club">Club administration</a>
</main>
