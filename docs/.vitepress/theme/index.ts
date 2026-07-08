import DefaultTheme from 'vitepress/theme'
import { h, nextTick, onMounted, watch } from 'vue'
import { useRoute } from 'vitepress'
import './style.css'

async function renderMermaid() {
  if (typeof window === 'undefined') return

  await nextTick()

  const mermaid = (await import('mermaid')).default
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
  })

  await mermaid.run({
    querySelector: '.mermaid',
  })
}

export default {
  extends: DefaultTheme,
  Layout() {
    const route = useRoute()

    onMounted(renderMermaid)
    watch(() => route.path, renderMermaid)

    return h(DefaultTheme.Layout)
  },
}
