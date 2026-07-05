<script lang="ts">
  let { subpath = '/', basePath = '/', params = {} }:
    { subpath?: string; basePath?: string; params?: Record<string, string> } = $props();
</script>

<section class="jorvel-remote">
  <h1>docs-site <small>(Svelte 5 remote)</small></h1>
  <p>Sub-path: <code>{subpath}</code></p>
  <p>This remote is mounted by the host through <code>@jorvel/mount</code>.</p>
</section>
