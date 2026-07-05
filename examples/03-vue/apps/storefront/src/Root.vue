<script setup lang="ts">
defineProps<{ subpath?: string; basePath?: string; params?: Record<string, string> }>();
</script>

<template>
  <section class="jorvel-remote">
    <h1>storefront <small>(Vue 3 remote)</small></h1>
    <p>Sub-path: <code>{{ subpath }}</code></p>
    <p>This remote is mounted by the host through <code>@jorvel/mount</code>.</p>
  </section>
</template>
