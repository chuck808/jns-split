<script lang="ts">
  import PublicHero from '#lib/ui/public/PublicHero.svelte';
  import Section from '#lib/ui/public/Section.svelte';

  const routes = [
    {
      lane: 1,
      title: 'Already with a club?',
      text: 'For help with your account or equipment, contact the person at your club who set up your access.',
      link: { href: '/help', label: 'Read the getting-started guide' }
    },
    {
      lane: 2,
      title: 'Want your club in the pilot?',
      text: 'Sign in and apply to register your club. We’ll review it and be in touch.',
      link: { href: '/clubs/request', label: 'Register your club' }
    },
    {
      lane: 3,
      title: 'Forgotten your password?',
      text: 'You can reset it yourself with the email your account was created with.',
      link: { href: '/forgot-password', label: 'Reset your password' }
    }
  ];
</script>

<svelte:head><title>Contact · JNS SPLIT</title></svelte:head>

<PublicHero
  compact
  eyebrow="Contact"
  title="Get in touch."
  lead="JNS SPLIT is in a pilot, so access is arranged directly with the clubs taking part."
/>

<Section eyebrow="Find the right route" title="How can we help?">
  <ul class="routes">
    {#each routes as route (route.title)}
      <li style:--lane={`var(--lane-${route.lane})`}>
        <h3>{route.title}</h3>
        <p>{route.text}</p>
        <a href={route.link.href}>{route.link.label} →</a>
      </li>
    {/each}
  </ul>
  <p class="note">A public support inbox isn’t open yet, and this page doesn’t collect messages.</p>
</Section>

<style>
  .routes {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.25rem;
  }
  li {
    background: var(--surface);
    border: 1px solid var(--edge);
    border-top: 6px solid var(--lane);
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
  li p {
    margin: 0;
    flex: 1;
    font-size: 1.0625rem;
    line-height: 1.55;
    color: var(--muted);
  }
  li a {
    display: inline-flex;
    align-items: center;
    min-height: var(--touch);
    font-weight: 600;
  }
  .note {
    margin: 0;
    color: var(--muted);
  }
  @media (max-width: 900px) {
    .routes {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
