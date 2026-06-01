import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'lanbito',
  description: 'lanbito 的个人文档站点',
  base: '/lanbito/', // GitHub Pages 部署时需要与仓库名一致

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: '/logo.svg',
    nav: [
      { text: '首页', link: '/' },
      { text: '指南', link: '/guide/getting-started' },
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
      '/react/': [
        {
          text: 'React 源码解析',
          items: [
            { text: '阅读索引', link: '/react/' },
            { text: '零、render / commit 总览', link: '/react/00-render-commit-overview' },
            { text: '一、渲染机制', link: '/react/01-rendering' },
            { text: '二、状态管理', link: '/react/02-state' },
            { text: '三、Hooks 原理', link: '/react/03-hooks' },
            { text: '四、事件系统', link: '/react/04-events' },
            { text: '五、调度器', link: '/react/05-scheduler' },
            { text: '六、协调器', link: '/react/06-reconciler' },
            { text: '七、生命周期与错误处理', link: '/react/07-lifecycle' },
            { text: '八、性能优化', link: '/react/08-performance' },
          ],
        },
      ],
      '/github-trending/': [
        {
          text: 'GitHub 热门项目',
          items: [
            { text: '2026-05-23', link: '/github-trending/2026-05-23' },
            { text: '2026-05-18', link: '/github-trending/2026-05-18' },
            { text: '2026-05-11', link: '/github-trending/2026-05-11' },
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
