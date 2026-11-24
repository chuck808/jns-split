<!-- Decorative: the four lane colours, as used on the posts and scoreboard. -->
<div class="ui-stripes" aria-hidden="true">
  <span style:background="var(--lane-1)"></span>
  <span style:background="var(--lane-2)"></span>
  <span style:background="var(--lane-3)"></span>
  <span style:background="var(--lane-4)"></span>
</div>

<style>
  .ui-stripes {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
    height: 8px;
    max-width: 280px;
  }
  span {
    border-radius: 999px;
  }
</style>
