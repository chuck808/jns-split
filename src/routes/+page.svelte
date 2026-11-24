<script lang="ts">
  import CtaBand from '#lib/ui/public/CtaBand.svelte';
  import ExampleScoreboard from '#lib/ui/public/ExampleScoreboard.svelte';
  import Faq from '#lib/ui/public/Faq.svelte';
  import NumberedSteps from '#lib/ui/public/NumberedSteps.svelte';
  import PublicHero from '#lib/ui/public/PublicHero.svelte';
  import Section from '#lib/ui/public/Section.svelte';
  import { faqs } from '#lib/ui/public/faqs';

  const steps = [
    {
      title: 'Register and tag',
      text: 'The club adds each rider once and gives them a small RFID tag. No phone or login needed to ride.'
    },
    {
      title: 'Tap in and ride',
      text: 'Riders tap their tag at a lane reader a few metres behind the start, then go. Flying, standing or freeride starts.'
    },
    {
      title: 'See every time',
      text: 'Times land on the lane display and the scoreboard, and are kept with the right rider for coaches and families.'
    }
  ];

  const kit = [
    {
      lane: 1,
      title: 'Start and finish posts',
      text: 'Light-beam posts that measure each effort over the distance you set.'
    },
    {
      lane: 2,
      title: 'Lane readers',
      text: 'Riders tap in here, so each time goes to the right person without anyone typing names.'
    },
    {
      lane: 3,
      title: 'Lane displays and scoreboard',
      text: 'Big, readable times at the track, for riders, coaches and parents on the fence.'
    },
    {
      lane: 4,
      title: 'The club app',
      text: 'Riders, tags, coaches and sessions in one place, on a laptop, tablet or phone.'
    }
  ];

  const roles = [
    {
      title: 'Club admins',
      text: 'Register the club, add riders and issue tags, invite coaches. Designed so one person can set up on the night.'
    },
    {
      title: 'Coaches',
      text: 'Plan sessions, see who is riding, and compare efforts over time instead of guessing.'
    },
    {
      title: 'Riders and families',
      text: 'See your own times and progress over the season. Families will see only their own child.'
    }
  ];

  const dataPoints = [
    {
      title: 'Year of birth by default',
      text: 'A full date of birth only if your club’s age groups need one. Nothing we don’t use.'
    },
    {
      title: 'No login needed to ride',
      text: 'Young riders just carry a tag. Nobody needs an account to take part.'
    },
    {
      title: 'Families see only their child',
      text: 'Family access is being built so a parent or guardian can follow their own rider, never anyone else’s.'
    },
    {
      title: 'Coaches see their sessions',
      text: 'Coaches see the riders in the sessions they run, not the whole club list.'
    }
  ];
</script>

<svelte:head>
  <title>JNS SPLIT · Timing for club sport</title>
  <meta
    name="description"
    content="JNS SPLIT is timing for club sport: riders tap in with a tag, ride, and every time is kept with the right rider. In a pilot with BMX clubs."
  />
</svelte:head>

<PublicHero
  eyebrow="Club timing · BMX pilot"
  title="Every effort counts."
  lead="Riders tap in with a tag, ride, and see their time straight away. Every result is kept with the right rider, so coaches and families can see real progress."
>
  {#snippet actions()}
    <a href="/clubs/request">Register your club</a>
    <a href="#how">See how it works</a>
  {/snippet}
  {#snippet aside()}<ExampleScoreboard />{/snippet}
</PublicHero>

<Section
  id="how"
  eyebrow="How it works"
  title="Tap. Ride. See your time."
  lead="A club session without clipboards or stopwatches."
>
  <NumberedSteps {steps} />
</Section>

<Section
  tone="raised"
  eyebrow="The kit"
  title="Built for the track"
  lead="Simple hardware at the track, with the club app behind it."
>
  <ul class="kit">
    {#each kit as item (item.title)}
      <li style:--lane={`var(--lane-${item.lane})`}>
        <h3>{item.title}</h3>
        <p>{item.text}</p>
      </li>
    {/each}
  </ul>
</Section>

<Section eyebrow="Who it’s for" title="One login. Whatever your role.">
  <ul class="cards">
    {#each roles as role (role.title)}
      <li>
        <h3>{role.title}</h3>
        <p>{role.text}</p>
      </li>
    {/each}
  </ul>
  <p class="note">
    Helping in more than one way? A club admin who also coaches uses one account and switches
    between roles.
  </p>
</Section>

<Section
  tone="raised"
  eyebrow="Children’s data"
  title="Careful with young riders"
  lead="Many riders are children, so JNS SPLIT is designed to hold as little as possible and to keep who can see it narrow."
>
  <ul class="data">
    {#each dataPoints as point (point.title)}
      <li>
        <span class="tick" aria-hidden="true">✓</span>
        <div>
          <h3>{point.title}</h3>
          <p>{point.text}</p>
        </div>
      </li>
    {/each}
  </ul>
</Section>

<Section eyebrow="Questions" title="Good to know">
  <Faq items={faqs} />
</Section>

<CtaBand
  title="Help us build it."
  text="JNS SPLIT is in a pilot with BMX clubs. If your club would like to take part, register and we’ll be in touch."
>
  {#snippet actions()}
    <a href="/clubs/request">Register your club</a>
    <a href="/about">Read more about us</a>
  {/snippet}
</CtaBand>

<style>
  h3 {
    margin: 0;
    font: 700 1.625rem/1 var(--font-display);
    text-transform: uppercase;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li p {
    margin: 0;
    font-size: 1.0625rem;
    line-height: 1.55;
    color: var(--muted);
  }
  .kit {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1.25rem;
  }
  .kit li {
    background: var(--surface);
    border: 1px solid var(--edge);
    border-left: 6px solid var(--lane);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .cards {
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
  .note {
    margin: 0;
    color: var(--muted);
  }
  .data {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem 2.5rem;
  }
  .data li {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
    padding: 1.25rem 0;
    border-top: 1px solid var(--edge);
  }
  .data div {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .tick {
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--accent-soft);
    border: 1px solid var(--accent-edge);
    color: var(--accent-text);
    font-weight: 700;
  }
  @media (max-width: 960px) {
    .kit {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .cards {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (max-width: 640px) {
    .kit,
    .data {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
