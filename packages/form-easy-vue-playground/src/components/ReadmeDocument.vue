<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { marked } from 'marked';
import readmeSource from '../../../../README.md?raw';
import h5SelectScreenshot from '../../../../docs/images/playground-h5-select.png';
import elementPlusSelectScreenshot from '../../../../docs/images/playground-element-plus-select.png';

/** README 二级标题对应的文档目录项。 */
interface DocumentHeading {
  /** 标题锚点。 */
  id: string;
  /** 标题展示文本。 */
  label: string;
}

/** 文档正文容器，用于观察当前阅读章节。 */
const documentBody = ref<HTMLElement>();
/** 当前进入阅读区域的章节锚点。 */
const activeHeadingId = ref('');
/** 当前章节观察器。 */
let headingObserver: IntersectionObserver | undefined;

/** 移除 Markdown 行内标记，生成适合目录展示的纯文本。 */
function normalizeHeadingLabel(value: string): string {
  return value
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[✨🚀📦💿⚡💚🧩🗺️✅🔄🛠️📤📄]/gu, '')
    .trim();
}

/** 将标题转换为稳定且可读的页面锚点。 */
function createHeadingId(label: string, index: number): string {
  const slug = label
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
  return `readme-${slug || 'section'}-${index + 1}`;
}

/** 从 README 中提取一级章节，供粘性目录使用。 */
const documentHeadings = computed<DocumentHeading[]>(() => {
  return Array.from(readmeSource.matchAll(/^##\s+(.+)$/gm)).map((match, index) => {
    const label = normalizeHeadingLabel(match[1]);
    return { label, id: createHeadingId(label, index) };
  });
});

/** 将仓库内图片路径替换为 Vite 可打包的资源地址。 */
const documentMarkdown = computed(() => readmeSource
  .replace(/^#\s+.+\r?\n/, '')
  .replace('./docs/images/playground-h5-select.png', h5SelectScreenshot)
  .replace('./docs/images/playground-element-plus-select.png', elementPlusSelectScreenshot));

/** 将 README Markdown 转换为带章节锚点的可信 HTML。 */
const documentHtml = computed(() => {
  let headingIndex = 0;
  const html = marked.parse(documentMarkdown.value, { gfm: true }) as string;
  return html
    .replace(/<h2>([\s\S]*?)<\/h2>/g, (_heading, content: string) => {
      const heading = documentHeadings.value[headingIndex++];
      return heading ? `<h2 id="${heading.id}">${content}</h2>` : `<h2>${content}</h2>`;
    })
    .replace(/<a href="https?:\/\/[^\"]+"/g, link => `${link} target="_blank" rel="noreferrer"`);
});

/** 点击目录时立即更新当前章节反馈。 */
function selectHeading(id: string): void {
  activeHeadingId.value = id;
}

/** 观察正文标题，在滚动阅读时同步高亮目录。 */
function observeHeadings(): void {
  headingObserver?.disconnect();
  const headings = Array.from(documentBody.value?.querySelectorAll<HTMLElement>('h2[id]') ?? []);
  if (headings.length === 0) return;
  activeHeadingId.value = headings[0].id;
  headingObserver = new IntersectionObserver(entries => {
    const visibleHeading = entries.find(entry => entry.isIntersecting);
    if (visibleHeading) activeHeadingId.value = visibleHeading.target.id;
  }, { rootMargin: '-72px 0px -72% 0px', threshold: 0 });
  headings.forEach(heading => headingObserver?.observe(heading));
}

onMounted(() => {
  void nextTick(observeHeadings);
});

onBeforeUnmount(() => {
  headingObserver?.disconnect();
});
</script>

<template>
  <section class="documentation" aria-labelledby="documentation-title">
    <header class="documentation-heading">
      <div>
        <p class="documentation-eyebrow">README / RENDERED HTML</p>
        <h1 id="documentation-title">项目文档</h1>
      </div>
      <p>将仓库 README 实时转换为 H5 内容，校验发布后用户看到的阅读效果。</p>
    </header>

    <div class="documentation-layout">
      <aside class="documentation-toc" aria-label="README 目录">
        <p>CONTENTS</p>
        <nav>
          <a
            v-for="heading in documentHeadings"
            :key="heading.id"
            :href="`#${heading.id}`"
            :class="{ active: activeHeadingId === heading.id }"
            :aria-current="activeHeadingId === heading.id ? 'location' : undefined"
            @click="selectHeading(heading.id)"
          >
            {{ heading.label }}
          </a>
        </nav>
      </aside>

      <article ref="documentBody" class="markdown-body" v-html="documentHtml"></article>
    </div>
  </section>
</template>

<style scoped>
.documentation {
  width: min(1200px, calc(100% - 48px));
  margin: 0 auto;
  padding: 64px 0 96px;
}

.documentation-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 48px;
  padding-bottom: 34px;
  border-bottom: 1px solid #d9deea;
}

.documentation-heading h1,
.documentation-heading p {
  margin-top: 0;
}

.documentation-heading h1 {
  margin-bottom: 0;
  color: #101827;
  font-size: clamp(34px, 5vw, 52px);
  line-height: .98;
  letter-spacing: -.055em;
}

.documentation-heading > p {
  max-width: 420px;
  margin-bottom: 0;
  color: #667085;
  font-size: 14px;
  line-height: 1.65;
  text-align: right;
}

.documentation-eyebrow {
  margin-bottom: 10px;
  color: #69748a;
  font-size: 11px;
  font-weight: 750;
  letter-spacing: .14em;
}

.documentation-layout {
  display: grid;
  grid-template-columns: 210px minmax(0, 760px);
  justify-content: space-between;
  gap: 72px;
  padding-top: 44px;
}

.documentation-toc {
  position: sticky;
  top: 92px;
  align-self: start;
  max-height: calc(100vh - 116px);
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: thin;
}

.documentation-toc > p {
  margin: 0 0 16px;
  color: #778298;
  font: 750 10px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
  letter-spacing: .14em;
}

.documentation-toc nav {
  display: grid;
  border-left: 1px solid #d9deea;
}

.documentation-toc a {
  position: relative;
  padding: 8px 0 8px 16px;
  color: #738096;
  font-size: 13px;
  line-height: 1.25;
  text-decoration: none;
  transition: color .16s ease, transform .16s ease;
}

.documentation-toc a::before {
  position: absolute;
  top: 7px;
  bottom: 7px;
  left: -1px;
  width: 2px;
  content: "";
  background: #101827;
  opacity: 0;
  transform: scaleY(.35);
  transition: opacity .16s ease, transform .16s ease;
}

.documentation-toc a:hover,
.documentation-toc a.active {
  color: #101827;
  transform: translateX(3px);
}

.documentation-toc a.active::before {
  opacity: 1;
  transform: scaleY(1);
}

.markdown-body {
  min-width: 0;
  color: #344054;
  font-size: 15px;
  line-height: 1.75;
  animation: document-in .3s ease-out both;
}

.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  color: #172033;
  letter-spacing: -.035em;
  scroll-margin-top: 88px;
}

.markdown-body :deep(h2) {
  margin: 72px 0 20px;
  padding-top: 4px;
  font-size: 28px;
  line-height: 1.2;
}

.markdown-body :deep(h2:first-child) {
  margin-top: 0;
}

.markdown-body :deep(h3) {
  margin: 42px 0 16px;
  font-size: 20px;
}

.markdown-body :deep(p) {
  margin: 0 0 18px;
}

.markdown-body :deep(a) {
  color: #2563eb;
  text-decoration-color: #93c5fd;
  text-underline-offset: 3px;
}

.markdown-body :deep(strong) {
  color: #172033;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 24px;
  margin: 0 0 22px;
}

.markdown-body :deep(li + li) {
  margin-top: 6px;
}

.markdown-body :deep(blockquote) {
  margin: 28px 0;
  padding: 4px 0 4px 18px;
  color: #526078;
  border-left: 3px solid #b9ff66;
}

.markdown-body :deep(code) {
  padding: 2px 5px;
  color: #9f3156;
  background: #f2f4f8;
  border-radius: 4px;
  font: .88em/1.5 ui-monospace, SFMono-Regular, Consolas, monospace;
}

.markdown-body :deep(pre) {
  margin: 22px 0 28px;
  overflow: auto;
  padding: 20px;
  color: #dbe5f5;
  background: #101827;
  border-radius: 8px;
  box-shadow: inset 0 1px rgb(255 255 255 / 6%);
}

.markdown-body :deep(pre code) {
  padding: 0;
  color: inherit;
  background: transparent;
  border-radius: 0;
  font-size: 12px;
  line-height: 1.65;
}

.markdown-body :deep(table) {
  width: 100%;
  margin: 24px 0 30px;
  border-collapse: collapse;
  font-size: 13px;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 11px 13px;
  border-bottom: 1px solid #dfe3eb;
  text-align: left;
  vertical-align: top;
}

.markdown-body :deep(th) {
  color: #172033;
  background: #f1f3f7;
  font-weight: 720;
}

.markdown-body :deep(img) {
  display: block;
  width: 100%;
  height: auto;
  margin: 26px 0 34px;
  border: 1px solid #d9deea;
  border-radius: 8px;
  box-shadow: 0 18px 48px rgb(16 24 39 / 10%);
}

.markdown-body :deep(hr) {
  margin: 56px 0;
  border: 0;
  border-top: 1px solid #d9deea;
}

@keyframes document-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 820px) {
  .documentation {
    width: min(100% - 32px, 640px);
    padding: 42px 0 72px;
  }

  .documentation-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 18px;
  }

  .documentation-heading > p {
    text-align: left;
  }

  .documentation-layout {
    grid-template-columns: 1fr;
    gap: 38px;
    padding-top: 28px;
  }

  .documentation-toc {
    position: static;
    max-height: none;
  }

  .documentation-toc nav {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 8px;
    border-left: 0;
  }

  .documentation-toc a {
    flex: 0 0 auto;
    padding: 8px 10px;
    background: #eef1f5;
    border-radius: 4px;
  }

  .documentation-toc a::before {
    display: none;
  }

  .documentation-toc a:hover,
  .documentation-toc a.active {
    background: #b9ff66;
    transform: none;
  }

  .markdown-body :deep(h2) {
    margin-top: 54px;
    font-size: 25px;
  }

  .markdown-body :deep(pre) {
    margin-right: -16px;
    margin-left: -16px;
    border-radius: 0;
  }

  .markdown-body :deep(table) {
    display: block;
    overflow-x: auto;
    white-space: nowrap;
  }
}

@media (prefers-reduced-motion: reduce) {
  .markdown-body,
  .documentation-toc a,
  .documentation-toc a::before {
    animation: none;
    transition: none;
  }
}
</style>
