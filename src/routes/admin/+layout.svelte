<script lang="ts">
  import AppShell from '#lib/ui/AppShell.svelte';
  let { data, children } = $props();
</script>

<AppShell
  shell={data.shell}
  theme={data.theme}
  area="Platform administration"
  context="Platform administration"
  homeHref="/admin"
  nav={[{ href: '/admin', label: 'Club applications', prefix: true }]}
>
  {@render children()}
</AppShell>
