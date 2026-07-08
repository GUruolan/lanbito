import DefaultTheme from 'vitepress/theme'
import { defineComponent, h, nextTick, onMounted, watch } from 'vue'
import { useRoute } from 'vitepress'
import './style.css'

async function renderMermaid() {
  if (typeof window === 'undefined') return

  await nextTick()
  await new Promise((resolve) => window.requestAnimationFrame(resolve))

  const nodes = Array.from(document.querySelectorAll<HTMLElement>('.mermaid:not([data-processed])'))
  if (!nodes.length) return

  const mermaid = (await import('mermaid')).default
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
  })

  for (const node of nodes) {
    try {
      await mermaid.run({ nodes: [node] })
    } catch (error) {
      console.error('Mermaid render failed', error)
    }
  }
}

const Layout = defineComponent({
  setup() {
    const route = useRoute()

    onMounted(renderMermaid)
    watch(() => route.path, renderMermaid, { flush: 'post' })

    return () => h(DefaultTheme.Layout)
  },
})

export default {
  extends: DefaultTheme,
  Layout,
}
