<template>
  <header class="mb-5 flex shrink-0 flex-wrap items-start justify-between gap-4">
    <div class="min-w-0">
      <h1 class="m-0 text-[1.35rem] font-bold leading-tight tracking-tight text-tclaw-text">
        {{ title }}
      </h1>
      <p v-if="description" class="mt-2 max-w-[52ch] text-[13px] leading-relaxed text-tclaw-text-muted">
        {{ description }}
      </p>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
/**
 * 页面顶栏：主标题、可选说明与右侧操作插槽。
 */
export interface PageHeaderProps {
  /** 页面主标题 */
  title: string
  /** 灰色副标题，简述本页用途 */
  description?: string
}

defineProps<PageHeaderProps>()
</script>
