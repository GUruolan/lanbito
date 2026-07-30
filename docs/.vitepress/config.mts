import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'lanbito',
  description: 'lanbito 的个人文档站点',
  base: '/lanbito/', // GitHub Pages 部署时需要与仓库名一致
  markdown: {
    config(md) {
      const defaultFence = md.renderer.rules.fence

      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx]
        const lang = token.info.trim().split(/\s+/)[0]

        if (lang === 'mermaid') {
          return `<pre class="mermaid" v-pre>${md.utils.escapeHtml(token.content)}</pre>`
        }

        return defaultFence
          ? defaultFence(tokens, idx, options, env, self)
          : self.renderToken(tokens, idx, options)
      }
    },
  },

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: '/logo.svg',
    nav: [
      { text: '首页', link: '/' },
      { text: '指南', link: '/guide/getting-started' },
      { text: 'Agent', link: '/agent/' },
      { text: 'GitHub', link: 'https://github.com/GUruolan' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: '指南',
          items: [
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '介绍', link: '/guide/introduction' },
          ],
        },
      ],
      '/github-trending/': [
        {
          text: 'GitHub 热门项目',
          items: [
            { text: '2026-06-20', link: '/github-trending/2026-06-20' },
            { text: '2026-06-13', link: '/github-trending/2026-06-13' },
            { text: '2026-06-06', link: '/github-trending/2026-06-06' },
            { text: '2026-06-01', link: '/github-trending/2026-06-01' },
            { text: '2026-05-30', link: '/github-trending/2026-05-30' },
            { text: '2026-05-23', link: '/github-trending/2026-05-23' },
            { text: '2026-05-18', link: '/github-trending/2026-05-18' },
            { text: '2026-05-11', link: '/github-trending/2026-05-11' },
          ],
        },
      ],
      '/java/': [
        {
          text: 'Java 全栈学习指南',
          items: [
            { text: '📋 总览与学习路线', link: '/java/' },
            { text: '01 基础语法', link: '/java/01-basics' },
            { text: '02 面向对象', link: '/java/02-oop' },
            { text: '03 集合框架与 Stream', link: '/java/03-collections' },
            { text: '04 并发编程', link: '/java/04-concurrency' },
            { text: '05 Spring Boot', link: '/java/05-spring-boot' },
            { text: '06 实战与进阶', link: '/java/06-practice' },
          ],
        },
      ],
      '/front-end/': [
        {
          text: '前端工程',
          items: [
            { text: '阅读索引', link: '/front-end/' },
            { text: '浏览器架构与前端渲染技术', link: '/front-end/browser-rendering-tech' },
            { text: 'Promise 与 async/await 手写实现', link: '/front-end/promise-async-await-implementation' },
          ],
        },
      ],
      '/agent/': [
        {
          text: 'Agent',
          items: [
            { text: '阅读索引', link: '/agent/' },
            { text: 'Agent 开发学习路径', link: '/agent/development-roadmap' },
          ],
        },
      ],
      '/deep-dive/': [
        {
          text: '刨根问底',
          items: [
            { text: '阅读索引', link: '/deep-dive/' },
            { text: '共享账号原理分析', link: '/deep-dive/shared-account-principle' },
            { text: 'MachPro 和 React Native 对比', link: '/deep-dive/machpro-vs-react-native' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/GUruolan' },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025 lanbito',
    },

    search: {
      provider: 'local',
    },
  },
})
