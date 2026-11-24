<script lang="ts">
  import Faq from '#lib/ui/public/Faq.svelte';
  import NumberedSteps from '#lib/ui/public/NumberedSteps.svelte';
  import PublicHero from '#lib/ui/public/PublicHero.svelte';
  import Section from '#lib/ui/public/Section.svelte';
  import { faqs } from '#lib/ui/public/faqs';

  const setup = [
    {
      title: 'Apply for your club',
      text: 'Sign in, then apply to register your club. Once it’s approved, you become its administrator.'
    },
    {
      title: 'Add riders and tags',
      text: 'In Riders & tags, register a rider (use made-up names while testing), then give them a tag with the base station.'
    },
    {
      title: 'Invite your coaches',
      text: 'In Coaches & access, invite your coaches. Once they accept, add them to sessions.'
    },
    {
      title: 'Plan a session',
      text: 'In Sessions, plan a coached session or an open practice.'
    }
  ];
</script>

<svelte:head><title>Help · JNS SPLIT</title></svelte:head>

<PublicHero
  compact
  eyebrow="Help"
  title="Getting started."
  lead="Everything a club needs to get from sign-in to its first planned session."
>
  {#snippet actions()}
    <a href="/clubs/request">Apply for your club</a>
    <a href="#base-station">Using the base station</a>
  {/snippet}
</PublicHero>

<Section eyebrow="Setting up your club" title="Four steps">
  <NumberedSteps steps={setup} />
</Section>

<Section tone="raised" eyebrow="Accounts" title="More than one role?">
  <div class="cols">
    <div class="block">
      <h3>One account, several roles</h3>
      <p>
        If you’re a club admin and a coach, the top of the sidebar always says which one you’re in.
        Switch between them from the account menu. You never need a second login.
      </p>
    </div>
    <div class="block">
      <h3>Can’t sign in?</h3>
      <p>
        Check you’re using the email your account was created with, or
        <a href="/forgot-password">reset your password</a>. If you’re running your own copy, your
        account must be in the same Supabase project as the app.
      </p>
    </div>
  </div>
</Section>

<Section id="family" eyebrow="Family access" title="Parents, guardians and riders">
  <div class="cols">
    <div class="block">
      <h3>For club admins</h3>
      <p>
        In Riders & tags, choose <strong>Manage</strong> on a rider, then
        <strong>Family access</strong>. Your club’s age bands (in Settings) decide whether you
        invite a parent or guardian, the rider, or choose. Check who they are with your club’s usual
        process, then create the invitation. No email is sent yet: ask them to sign in with that
        address within seven days.
      </p>
    </div>
    <div class="block">
      <h3>For parents and riders</h3>
      <p>
        Sign in, or create an account, with the email the club used. Open
        <strong>Riders and family</strong> and accept. You’ll see the details the club holds, can ask
        for a correction, and can choose how the name appears on the scoreboard. Each child needs their
        own invitation.
      </p>
    </div>
  </div>
</Section>

<Section id="base-station" tone="raised" eyebrow="Equipment" title="Using the base station">
  <div class="cols">
    <div class="block">
      <h3>Connecting</h3>
      <p>
        Plug the reader into the club laptop by USB and choose <strong>Connect base station</strong>
        on Riders & tags. Use Chrome or Edge on a computer: USB reading doesn’t work on phones.
      </p>
    </div>
    <div class="block">
      <h3>If it won’t connect</h3>
      <p>
        Close the Arduino or PlatformIO Serial Monitor first. Only one program can use the reader at
        a time.
      </p>
    </div>
  </div>
  <p class="note">
    Reading a tag at the desk doesn’t check a rider in at a lane. Lane check-in comes with the
    timing equipment. To try things without hardware, <a href="/bench">open the bench simulator</a>.
  </p>
</Section>

<Section eyebrow="Questions" title="Good to know">
  <Faq items={faqs} />
  <p class="note">Still stuck? <a href="/contact">Here’s how to get in touch</a>.</p>
</Section>

<style>
  .cols {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.25rem;
  }
  .block {
    background: var(--surface);
    border: 1px solid var(--edge);
    border-radius: var(--radius-lg);
    padding: 1.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  h3 {
    margin: 0;
    font: 700 1.625rem/1 var(--font-display);
    text-transform: uppercase;
  }
  .block p {
    margin: 0;
    font-size: 1.0625rem;
    line-height: 1.55;
    color: var(--muted);
  }
  .note {
    margin: 0;
    color: var(--muted);
  }
  @media (max-width: 760px) {
    .cols {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
