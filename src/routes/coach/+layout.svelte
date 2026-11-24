<script lang="ts">
  import AppShell from '#lib/ui/AppShell.svelte';
  let { data, children } = $props();
</script>

<AppShell
  shell={data.shell}
  theme={data.theme}
  area="Coach"
  context="Coach"
  homeHref="/coach"
  nav={[
    { href: '/coach', label: 'Home' },
    { href: '/coach/sessions', label: 'My sessions', prefix: true }
  ]}
>
  {@render children()}
</AppShell>
