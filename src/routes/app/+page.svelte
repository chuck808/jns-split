<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head><title>Your workspaces · JNS SPLIT</title></svelte:head>
<main class="account-page wide">
  <span class="eyebrow">JNS SPLIT</span>
  <h1>Where would you like to work?</h1>
  <p>
    Signed in as {data.email}. Choose a workspace below. You can switch at any time without signing
    out.
  </p>
  {#if form?.message}<p class="feedback error" role="alert">{form.message}</p>{/if}
  <div class="feature-grid workspace-cards">
    {#each data.items as workspace}<section class="panel">
        <h2>{workspace.label}</h2>
        <p>{workspace.description}</p>
        <form method="POST">
          <input type="hidden" name="workspace" value={workspace.key} /><button class="solid">
            Open {workspace.label}
          </button>
        </form>
      </section>{/each}
  </div>
  {#if !data.items.length}<section class="panel">
      <h2>No workspaces linked yet</h2>
      <p>
        Ask your club administrator for an invitation using your confirmed account email. You cannot
        choose a role to grant yourself access.
      </p>
      <a class="text-link" href="/coach">Check coach invitations</a>
      <p>
        Setting up this private pilot? <a href="/club">Open existing club setup</a>. Public club
        applications are not available yet.
      </p>
    </section>{/if}
  <p class="caption">
    Your choice is remembered on this browser for this account and checked against current
    permissions each time you return. Switching workspace changes the view, not your access rights.
  </p>
  <a class="text-link" href="/account">Account settings</a>
</main>
