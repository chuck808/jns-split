<script lang="ts">
  import AppShell from '#lib/ui/AppShell.svelte';
  let { data, children } = $props();
</script>

<AppShell
  shell={data.shell}
  theme={data.theme}
  area="Riders"
  context="Riders and family"
  homeHref="/riders"
  nav={[{ href: '/riders', label: 'Home' }]}
>
  {@render children()}
</AppShell>
