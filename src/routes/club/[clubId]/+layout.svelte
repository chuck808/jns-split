<script lang="ts">
  import AppShell from '#lib/ui/AppShell.svelte';
  import type { NavItem } from '#lib/ui/types';
  let { data, children } = $props();
  const base = $derived(`/club/${data.club.id}`);
  const nav: NavItem[] = $derived([
    { href: base, label: 'Home' },
    { href: `${base}/sessions`, label: 'Sessions', prefix: true },
    { href: `${base}/riders`, label: 'Riders & tags', prefix: true },
    { href: `${base}/coaches`, label: 'Coaches & access', prefix: true },
    { href: `${base}/equipment`, label: 'Test equipment', prefix: true },
    { href: `${base}/settings`, label: 'Settings', prefix: true },
    { href: '/bench', label: 'Bench simulator' }
  ]);
</script>

<AppShell shell={data.shell} theme={data.theme} area="Club" {nav} homeHref={base}>
  {@render children()}
</AppShell>
