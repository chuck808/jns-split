<script lang="ts">
  import Card from '#lib/ui/Card.svelte';
  import LaneStripes from '#lib/ui/LaneStripes.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import PublicPage from '#lib/ui/PublicPage.svelte';
</script>

<svelte:head><title>About · JNS SPLIT</title></svelte:head>

<PublicPage>
  <LaneStripes />
  <PageHeader
    eyebrow="Why JNS SPLIT"
    title="Useful timing, within reach"
    description="JNS SPLIT started with a simple aim: make sports timing and useful feedback affordable for more clubs and riders."
  />
  <Card title="Built around a club session">
    <p>
      The club registers its riders and gives each one a tag. At the track, riders tap in at their
      lane, the timing posts measure the effort, and the app keeps each result with the right rider.
    </p>
  </Card>
  <Card title="BMX first, other sports later">
    <p>
      The pilot is for BMX. Everything is built on distance, start type and measured time, so other
      sports — like athletics sprints — can follow.
    </p>
  </Card>
  <Card title="Where we are today">
    <p>
      Club registration, riders and tags, coaches and session planning are working. Timing at the
      lanes and recorded results are the next steps. The bench simulator uses demonstration data,
      not real timings.
    </p>
  </Card>
</PublicPage>
