<script lang="ts">
  import Button from '#lib/ui/Button.svelte';
  import Card from '#lib/ui/Card.svelte';
  import CardGrid from '#lib/ui/CardGrid.svelte';
  import LaneStripes from '#lib/ui/LaneStripes.svelte';
  import PublicPage from '#lib/ui/PublicPage.svelte';
</script>

<svelte:head>
  <title>JNS SPLIT · Every effort counts.</title><meta
    name="description"
    content="Affordable sports timing and straightforward club session management."
  />
</svelte:head>

<PublicPage width="wide">
  <section class="hero">
    <LaneStripes />
    <p class="eyebrow-text">Sports timing for clubs</p>
    <h1>Every effort counts.</h1>
    <p class="lead">
      Less admin at the track, more time helping riders improve. Rider registration, timing
      equipment and results in one place for your club.
    </p>
    <div class="actions">
      <Button variant="primary" size="lg" href="/login">Sign in</Button>
      <Button size="lg" href="/clubs/request">Register your club</Button>
    </div>
  </section>

  <CardGrid columns={3}>
    <Card title="Know your riders">
      <p>
        Keep your club register in one place. Issue or replace tags without a rider ever losing
        their history.
      </p>
    </Card>
    <Card title="Keep sessions moving">
      <p>
        Riders tap their tag at the lane and go. No clipboards, no shouting names across the start
        hill.
      </p>
    </Card>
    <Card title="Make progress visible">
      <p>
        Clear times and fair comparisons — same distance, same start type — for riders, coaches and
        families.
      </p>
    </Card>
  </CardGrid>

  <Card title="Where we are today">
    <p>
      JNS SPLIT is in a development pilot with BMX clubs. Club registration, riders and tags, and
      session planning work now. Timing at the lanes and recorded results are next.
    </p>
    <p class="note">Please use made-up riders while testing.</p>
    <div class="links">
      <a href="/about">About JNS SPLIT</a>
      <a href="/help">Getting started</a>
      <a href="/bench">Try the bench simulator</a>
    </div>
  </Card>
</PublicPage>

<style>
  .hero {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 2rem 0 1rem;
  }
  .eyebrow-text {
    margin: 0.5rem 0 0;
    font-size: 0.875rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  h1 {
    margin: 0;
    font-size: clamp(3rem, 8vw, 5.5rem);
    font-style: italic;
    line-height: 0.95;
  }
  .lead {
    margin: 0;
    max-width: 58ch;
    font-size: 1.125rem;
    color: var(--text);
  }
  .actions,
  .links {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .actions {
    margin-top: 0.5rem;
  }
  .links {
    gap: 1.25rem;
  }
  .note {
    font-size: 0.875rem;
    color: var(--muted);
  }
</style>
