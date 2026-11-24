<script lang="ts">
  import CtaBand from '#lib/ui/public/CtaBand.svelte';
  import NumberedSteps from '#lib/ui/public/NumberedSteps.svelte';
  import PublicHero from '#lib/ui/public/PublicHero.svelte';
  import Section from '#lib/ui/public/Section.svelte';

  const principles = [
    {
      title: 'Within a club’s reach',
      text: 'Timing and useful feedback shouldn’t be only for national squads. The aim is kit and software a club can afford and run itself.'
    },
    {
      title: 'Built around a session',
      text: 'The club registers riders and gives each a tag. At the track, riders tap in at their lane, the posts measure the effort, and the app keeps each time with the right rider.'
    },
    {
      title: 'One person can run it',
      text: 'That’s the design aim: one volunteer sets up on the night, and coaches get on with coaching.'
    }
  ];

  const progress = [
    {
      title: 'Working now',
      text: 'Club registration, riders and tags, coaches and access, and session planning.'
    },
    {
      title: 'Testing next',
      text: 'A single timing lane at a club track, first on its own and then linked to the app.'
    },
    {
      title: 'After that',
      text: 'Recorded results, progress over time, family access, then more lanes and more sports.'
    }
  ];
</script>

<svelte:head><title>About · JNS SPLIT</title></svelte:head>

<PublicHero
  compact
  eyebrow="About JNS SPLIT"
  title="Useful timing, within reach."
  lead="JNS SPLIT started with a simple aim: make sports timing and useful feedback affordable for more clubs and riders."
/>

<Section eyebrow="What we believe" title="Why we’re building it">
  <ul class="cards">
    {#each principles as item (item.title)}
      <li>
        <h3>{item.title}</h3>
        <p>{item.text}</p>
      </li>
    {/each}
  </ul>
</Section>

<Section
  tone="raised"
  eyebrow="BMX first"
  title="Other sports later"
  lead="The pilot is with BMX clubs. Everything is built on distance, start type and measured time, so sprint-based sports such as athletics can follow."
/>

<Section
  eyebrow="Where we are"
  title="An honest progress report"
  lead="JNS SPLIT is a pilot, not a finished product. The bench simulator uses demonstration data, not real timings."
>
  <NumberedSteps steps={progress} />
</Section>

<CtaBand
  title="Help us build it."
  text="Clubs in the pilot shape what gets built next. If that sounds like your club, register and we’ll be in touch."
>
  {#snippet actions()}
    <a href="/clubs/request">Register your club</a>
    <a href="/contact">Contact us</a>
  {/snippet}
</CtaBand>

<style>
  .cards {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.25rem;
  }
  .cards li {
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
  p {
    margin: 0;
    font-size: 1.0625rem;
    line-height: 1.55;
    color: var(--muted);
  }
  @media (max-width: 960px) {
    .cards {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
