/**
 * tsdown 配置：把 src/client/index.ts 构建成浏览器半身 lib/client.js。
 *
 * 产物契约（与 dsh web 壳的模块系统对齐，见 monorepo
 * packages/client/tsdown.client.ts 的 clientConfig）：
 * 1. CJS 格式，用 banner/footer/intro 包成
 *    window.__ModuleLoader__.load({ id, factory: (require) => { ... } })
 *    —— 浏览器只注册 factory，模块体副作用推迟到材质化执行；
 * 2. 平台基线模块（react、cordis、slots 等，web 壳冻结模块表里的种子项）
 *    保持 require 外部引用，由模块表的 require 回答；
 * 3. 其余依赖全部内联（本插件除 react 外没有其他依赖）。
 */
import { defineConfig } from 'tsdown'

const PLUGIN_ID = 'dsh-conversation-map'

/** web 壳冻结模块表的基线 specifier（packages/client/web/src/platform.ts）。 */
const PLATFORM_EXTERNALS = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
])

export default defineConfig({
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: ['cjs'],
  platform: 'browser',
  target: 'es2022',
  sourcemap: true,
  clean: true,
  dts: false,
  deps: {
    neverBundle: (specifier: string) => PLATFORM_EXTERNALS.has(specifier),
    alwaysBundle: (specifier: string) => !PLATFORM_EXTERNALS.has(specifier),
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
})
