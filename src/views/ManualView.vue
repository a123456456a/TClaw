<template>
  <div class="tclaw-page tclaw-page--scroll manual-view">
    <PageHeader
      title="使用手册"
      description="安装、配置与各功能模块说明；内容与仓库内 Markdown 源同步。"
    />
    <article
      class="manual-view__article tclaw-panel prose prose-invert prose-sm max-w-none px-8 py-7 prose-headings:scroll-mt-4 prose-h1:border-b prose-h1:border-tclaw-border prose-h1:pb-3 prose-h1:text-tclaw-text prose-h2:text-tclaw-accent prose-a:text-tclaw-accent prose-a:no-underline hover:prose-a:underline prose-code:rounded-md prose-code:bg-tclaw-accent-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-tclaw-accent-hover prose-code:before:content-none prose-code:after:content-none prose-pre:border prose-pre:border-tclaw-border prose-pre:bg-tclaw-bg-deep prose-th:border-tclaw-border prose-td:border-tclaw-border"
      v-html="manualHtml"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import PageHeader from '@/components/PageHeader.vue'
import manualSource from '@/content/USER_GUIDE.md?raw'

/**
 * 将内置 Markdown 渲染为 HTML（应用内文档，可信来源）。
 */
const manualHtml = computed(() => marked.parse(manualSource) as string)
</script>

<style scoped>
.manual-view__article {
  margin-left: auto;
  margin-right: auto;
  width: 100%;
  max-width: 52rem;
}
</style>
