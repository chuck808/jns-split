<script lang="ts">
  import { page } from '$app/state';
  let { value = 'system' } = $props();
</script>

<form method="POST" action="/preferences" class="theme-picker">
  <input type="hidden" name="returnTo" value={page.url.pathname + page.url.search} />
  <label>
    Theme<select name="theme" value={value}>
      <option value="system">System</option><option value="light">Light</option><option
        value="dark"
      >
        Dark
      </option>
    </select>
  </label>
  <button type="submit">Apply</button>
</form>
