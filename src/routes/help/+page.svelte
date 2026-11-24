<script lang="ts">
  import Card from '#lib/ui/Card.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import PublicPage from '#lib/ui/PublicPage.svelte';
</script>

<svelte:head><title>Help · JNS SPLIT</title></svelte:head>

<PublicPage>
  <PageHeader title="Getting started" />

  <Card title="Setting up your club">
    <ol class="steps">
      <li>Sign in with the account you were given.</li>
      <li>
        <a href="/clubs/request">Apply to register your club</a>. Once it’s approved, you become its
        administrator.
      </li>
      <li>
        In <strong>Riders & tags</strong>, register a rider (use made-up names while testing), then
        give them a tag with the base station.
      </li>
      <li>
        In <strong>Coaches & access</strong>, invite your coaches. Once they accept, add them to
        sessions.
      </li>
      <li>In <strong>Sessions</strong>, plan a coached session or open practice.</li>
    </ol>
  </Card>

  <Card title="Several roles on one account?">
    <p>
      If you’re a club admin and a coach, the top of the sidebar always says which one you’re using.
      Switch between them from the account menu — you never need a second login.
    </p>
  </Card>

  <Card title="Using the base station">
    <p>
      Plug the reader into the club laptop by USB and choose <strong>Connect base station</strong>
      on Riders & tags. Close the Arduino or PlatformIO Serial Monitor first, and use Chrome or Edge on
      a computer — USB reading doesn’t work on phones.
    </p>
    <p class="note">
      Reading a tag at the desk doesn’t check a rider in at a lane. Lane check-in comes with the
      timing equipment.
    </p>
    <a href="/bench">Open the bench simulator</a>
  </Card>

  <Card title="Can’t sign in?">
    <p>
      Check you’re using the email your account was created with, or
      <a href="/forgot-password">reset your password</a>. If you’re running your own copy, your
      account must be in the same Supabase project as the app.
    </p>
  </Card>
</PublicPage>

<style>
  .steps {
    margin: 0;
    padding-left: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .note {
    font-size: 0.875rem;
    color: var(--muted);
  }
</style>
