<script lang="ts">
  import AppShell from '#lib/ui/AppShell.svelte';
  let { data, children } = $props();
</script>

<AppShell
  shell={data.shell}
  theme={data.theme}
  area="Club registration"
  context="Club registration"
  nav={[{ href: '/clubs/request', label: 'Your applications', prefix: false }]}
>
  {@render children()}
</AppShell>
