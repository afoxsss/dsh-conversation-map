/**
 * dsh-conversation-map — 浏览器半身。
 *
 * 在对话区右侧渲染一条可拖动调宽的会话代码地图：
 * - 宽度 < 50px：色块模式（按消息类型着色，悬停显示内容预览）；
 * - 宽度 ≥ 50px：缩略图模式（整段会话按比例缩微显示）；
 * - 点击跳转、按住拖动快速滚动，视口指示条实时跟随；
 * - 缩略图模式悬停放大镜：整行内容等比放大预览（缩放上限 1:1），面板在光标
 *   左侧、随鼠标垂直移动实时跟随；
 * - 左侧把手拖动调宽（10–320px），顶部 » 收起为 4px 细条（收起后顶部常显
 *   « 标签，点击标签或细条均可展开，避免收起后"找不到"地图）；
 * - 地图高度随会话内容实时伸缩：缩略图模式恒按等比缩微后的高度显示（保持真实
 *   宽高比、不拉伸），高度随内容连续增长至封顶可用高度；内容超过轨道后缩微图
 *   随滚动垂直平移（minimap 语义），可见区始终落在轨道内。
 *
 * 依赖的 DOM 契约（dsh web 会话列）：
 * - [data-conversation-scroll]  会话滚动容器。注意：每次切换会话时，框架会把
 *   session-maybe 的会话列整体重建，该容器是全新的 DOM 节点——插件不长期持有
 *   旧节点，而是在每次计算时重新解析并重绑观察器（见挂载 effect）。
 * - [data-chat-anchor-key]      每条会话节点行（data-chat-flow-kind 为类型）
 * - [data-composer-seat]        底部输入区（地图避开它）
 * - [data-slot="conversation"]  会话列的稳定槽位锚点（MutationObserver 挂载点，
 *   锚点缺失时退回 document.body）
 */
import * as React from 'react'
import { MINIMAP_CSS } from './style'

/** 槽位服务（与 @deepseek-ai/dsh-client-ui-slots 注册面一致的最小结构）。 */
interface SlotsService {
  inject(key: string, callback: () => () => void): () => void
  register(
    options: { name: string; id: string; order?: number; label?: string | (() => string) },
    component: unknown,
  ): () => void
}

/** 客户端根上下文（仅使用到的字段）。 */
interface PluginContext {
  slots: SlotsService
  effect(callback: () => void | (() => void)): () => void
}

interface Bar {
  key: string
  kind: string
  top: number
  height: number
  text: string
}

interface Box {
  right: number
  top: number
  height: number
  /** 缩略图按"地图宽 / 内容宽"等比缩微后的内容高度（封顶可用高度）。 */
  thumbH: number
}

interface ThumbModel {
  inner: HTMLDivElement
  w: number
  h: number
}

/** 悬停放大镜（loupe）状态：面板位置、内容平移与缩放（整行等比展示）。 */
interface LoupeState {
  left: number
  top: number
  tx: number
  ty: number
  s: number
}

const KIND_LABELS: Record<string, string> = {
  user: '用户消息',
  'assistant-step': '助手回复',
  'tool-call': '工具调用',
  command: '命令',
  'command-input': '命令输入',
  compaction: '上下文压缩',
  context: '上下文节点',
  'manual-compaction': '手动压缩',
  'model-retry': '模型重试',
  steering: '引导节点',
  'turn-error': '回合错误',
  'turn-max-tokens': 'Token 上限',
  'turn-tail': '回合尾注',
  unknown: '未知节点',
  'workflow-run': '工作流运行',
}

const MAX_SNIPPET = 220
/** 宽度达到该值时从色块模式切换为缩略图模式。 */
const THUMB_MIN_WIDTH = 50
/** 缩略图模式下内容不足一屏时，地图轨道的最低高度（容纳把手与收起按钮）。 */
const THUMB_BOX_MIN = 48
const WIDTH_MIN = 10
const WIDTH_MAX = 320
/** 缩略图重克隆的最小间隔（流式输出期间约 5 次/秒）。 */
const THUMB_CLONE_INTERVAL = 200
/** 悬停放大镜面板尺寸与内容缩放上限（1 = 真实比例，宽于面板的内容按面板宽度整行缩微）。 */
const LOUPE_W = 854
const LOUPE_H = 200
const LOUPE_SCALE = 1
/** 放大镜与光标的间距 / 距视口边缘的最小留白。 */
const LOUPE_GAP = 14
const LOUPE_EDGE = 8

/** 宽度/收起状态的 localStorage 键（跨刷新持久化，保持地图"常驻"）。 */
const STORAGE_WIDTH_KEY = 'dsh-conversation-map:width'
const STORAGE_COLLAPSED_KEY = 'dsh-conversation-map:collapsed'

function readStoredNumber(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    const value = parseFloat(raw)
    if (!Number.isFinite(value)) return fallback
    return Math.min(max, Math.max(min, value))
  } catch (_error) {
    // 存储不可用（隐私模式等）：退回默认值。
    return fallback
  }
}

function readStoredFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch (_error) {
    return false
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch (_error) {
    // 存储不可用：忽略，仅影响跨刷新持久化。
  }
}

function scrollbarWidthOf(scrollport: Element): number {
  try {
    const raw = window.getComputedStyle(scrollport).getPropertyValue('--dsh-scrollbar-width')
    const value = parseFloat(raw)
    if (Number.isFinite(value) && value > 0) return value
  } catch (_error) {
    // fall through to the default
  }
  return 8
}

function ConversationMinimap(): React.ReactElement | null {
  const [bars, setBars] = React.useState<Bar[]>([])
  const [viewport, setViewport] = React.useState<{ top: number; height: number }>({ top: 0, height: 1 })
  const [box, setBox] = React.useState<Box | null>(null)
  const [collapsed, setCollapsed] = React.useState<boolean>(() => readStoredFlag(STORAGE_COLLAPSED_KEY))
  const [dragging, setDragging] = React.useState(false)
  const [hover, setHover] = React.useState<Bar | null>(null)
  const [width, setWidth] = React.useState<number>(() => readStoredNumber(STORAGE_WIDTH_KEY, 16, WIDTH_MIN, WIDTH_MAX))
  const [resizing, setResizing] = React.useState(false)
  const [loupe, setLoupe] = React.useState<LoupeState | null>(null)
  /** 放大镜是否打开（状态派生，供 effect 依赖与同步判断）。 */
  const loupeOpen = loupe !== null

  const scrollportRef = React.useRef<Element | null>(null)
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const thumbRef = React.useRef<HTMLDivElement | null>(null)
  const thumbModelRef = React.useRef<ThumbModel | null>(null)
  const thumbLoopRef = React.useRef(0)
  const thumbQueuedRef = React.useRef(false)
  const lastCloneAtRef = React.useRef(0)
  const lastFlowWidthRef = React.useRef(0)
  const computeRef = React.useRef<() => void>(() => {})
  const widthRef = React.useRef(width)
  const thumbModeRef = React.useRef(false)
  const draggingRef = React.useRef(false)
  const resizingRef = React.useRef(false)
  const resizeStartRef = React.useRef({ x: 0, width: 16 })
  const loupeInnerRef = React.useRef<HTMLDivElement | null>(null)
  const loupeOpenRef = React.useRef(false)
  const loupeScreenRef = React.useRef({ x: 0, y: 0 })
  /** 当前视口（滚动）比例：缩略图平移与指示条对齐同源；克隆/缩放在 React
   *  渲染前执行，须经 ref 读取最新值。 */
  const viewportRef = React.useRef({ top: 0, height: 1 })

  /** 缩略图当前的仿射参数（与 applyThumbScale 同源），用于反解悬停坐标。
   *  恒等比缩放（缩略图永不拉伸）；内容高于轨道时按 minimap 语义随滚动垂直
   *  平移：可见区在轨道内居中，并钳制于内容边界。 */
  const thumbTransform = (): { sx: number; sy: number; tx: number; ty: number; scaledH: number } | null => {
    const container = thumbRef.current
    const model = thumbModelRef.current
    if (container === null || model === null) return null
    const cw = container.clientWidth
    const ch = container.clientHeight
    if (cw <= 0 || ch <= 0) return null
    const s = Math.min(cw / model.w, ch / model.h)
    const scaledH = model.h * s
    let ty = (ch - scaledH) / 2
    if (scaledH > ch) {
      const vp = viewportRef.current
      const visibleH = Math.max(1, vp.height * scaledH)
      const ideal = ch / 2 - (vp.top * scaledH + visibleH / 2)
      ty = Math.min(0, Math.max(ch - scaledH, ideal))
    }
    return { sx: s, sy: s, tx: 0, ty, scaledH }
  }

  const applyThumbScale = (): void => {
    const container = thumbRef.current
    const model = thumbModelRef.current
    if (container === null || model === null) return
    const t = thumbTransform()
    if (t === null) return
    model.inner.style.transform = 'translate(0px, ' + t.ty + 'px) scale(' + t.sx + ')'
  }

  const closeLoupe = (): void => {
    if (!loupeOpenRef.current) return
    loupeOpenRef.current = false
    setLoupe(null)
  }

  /** 用当前缩略图克隆重建放大镜内容（与缩略图同源，缩放比例独立）。 */
  const rebuildLoupe = (): void => {
    const model = thumbModelRef.current
    const innerEl = loupeInnerRef.current
    if (model === null || innerEl === null) return
    const children: Node[] = []
    model.inner.childNodes.forEach((node) => { children.push(node.cloneNode(true)) })
    innerEl.replaceChildren(...children)
    innerEl.style.width = model.w + 'px'
    innerEl.style.height = model.h + 'px'
  }

  /** 计算放大镜状态：面板置于光标左侧（空间不足翻到右侧），整行按面板宽度
   *  等比展示（缩放上限 LOUPE_SCALE），垂直方向以光标内容点为中心实时跟随。 */
  const loupeStateAt = (clientX: number, clientY: number): LoupeState | null => {
    const container = thumbRef.current
    const model = thumbModelRef.current
    if (container === null || model === null) return null
    const t = thumbTransform()
    if (t === null) return null
    const rect = container.getBoundingClientRect()
    // 整行展示：水平缩放 = 面板宽 / 内容宽（不超过 LOUPE_SCALE），横向恒居中，
    // 不再随光标左右平移；垂直方向仍以光标位置为中心并钳制在内容内。
    const s = Math.min(LOUPE_SCALE, LOUPE_W / model.w)
    const cx = model.w / 2
    let cy = (clientY - rect.top - t.ty) / t.sy
    const halfH = LOUPE_H / (2 * s)
    if (model.h <= halfH * 2) cy = model.h / 2
    else cy = Math.min(model.h - halfH, Math.max(halfH, cy))
    const vw = window.innerWidth
    const vh = window.innerHeight
    let left = clientX - LOUPE_W - LOUPE_GAP
    if (left < LOUPE_EDGE) {
      left = Math.min(clientX + LOUPE_GAP, Math.max(LOUPE_EDGE, vw - LOUPE_W - LOUPE_EDGE))
    }
    const top = Math.min(vh - LOUPE_H - LOUPE_EDGE, Math.max(LOUPE_EDGE, clientY - LOUPE_H / 2))
    return { left, top, tx: LOUPE_W / 2 - cx * s, ty: LOUPE_H / 2 - cy * s, s }
  }

  const cloneThumb = (): void => {
    const sp = scrollportRef.current
    const container = thumbRef.current
    lastCloneAtRef.current = Date.now()
    if (sp === null || container === null) return
    const flow = sp.querySelector('[data-chat-flow]')
    if (flow === null) {
      container.replaceChildren()
      thumbModelRef.current = null
      closeLoupe()
      return
    }
    const rect = flow.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const node = flow.cloneNode(true) as HTMLElement
    for (const el of node.querySelectorAll('iframe, video, audio')) el.remove()
    const inner = document.createElement('div')
    inner.className = 'dshcm-thumb-inner'
    inner.style.width = rect.width + 'px'
    inner.style.height = rect.height + 'px'
    inner.appendChild(node)
    container.replaceChildren(inner)
    thumbModelRef.current = { inner, w: rect.width, h: rect.height }
    applyThumbScale()
    if (loupeOpenRef.current) {
      // 内容更新：放大镜同步重建，并保持光标处内容继续对准。
      rebuildLoupe()
      const refreshed = loupeStateAt(loupeScreenRef.current.x, loupeScreenRef.current.y)
      if (refreshed !== null) setLoupe(refreshed)
    }
  }

  const scheduleThumbClone = (force: boolean): void => {
    if (!thumbModeRef.current) return
    if (force) {
      thumbQueuedRef.current = false
      if (thumbLoopRef.current !== 0) {
        if (typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(thumbLoopRef.current)
        thumbLoopRef.current = 0
      }
      cloneThumb()
      return
    }
    if (thumbQueuedRef.current) return
    thumbQueuedRef.current = true
    const run = (): void => {
      thumbLoopRef.current = 0
      if (!thumbModeRef.current || !thumbQueuedRef.current) { thumbQueuedRef.current = false; return }
      if (Date.now() - lastCloneAtRef.current >= THUMB_CLONE_INTERVAL) {
        thumbQueuedRef.current = false
        cloneThumb()
      } else {
        thumbLoopRef.current = window.requestAnimationFrame(run)
      }
    }
    thumbLoopRef.current = window.requestAnimationFrame(run)
  }

  React.useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return undefined
    let pending = false
    let rafId = 0
    let resizeObserver: ResizeObserver | null = null

    // 切换会话时框架会整体重建会话列（session-maybe 槽位按会话重挂载），
    // 滚动容器随之换成新 DOM 节点。因此 MutationObserver 观察稳定祖先——
    // 优先会话列的槽位锚点（display:contents，但仍在树中可被观察），
    // 锚点缺失（旧版外壳）时退回 document.body。
    const watchRoot: Node = document.querySelector('[data-slot="conversation"]') ?? document.body

    const schedule = (): void => {
      if (pending) return
      pending = true
      if (typeof window.requestAnimationFrame === 'function') {
        rafId = window.requestAnimationFrame(() => { compute() })
      } else {
        rafId = 0
        compute()
      }
    }

    const onScroll = (): void => { schedule() }

    /** 每次调用重新解析当前会话的滚动容器（不缓存，节点可能在会话切换时被替换）。 */
    const resolveScrollport = (): Element | null => {
      const direct = document.querySelector('[data-conversation-scroll]')
      if (direct !== null && direct.isConnected) return direct
      const flow = document.querySelector('[data-chat-flow]')
      let node = flow === null ? null : flow.parentElement
      while (node !== null && !(node.scrollHeight > node.clientHeight + 1)) node = node.parentElement
      return node !== null && node.isConnected ? node : null
    }

    /** 滚动容器换节点时重绑依赖它的观察器与监听，并失效缩略图缓存。 */
    const rebindScrollport = (next: Element | null): void => {
      const current = scrollportRef.current
      if (next === current) return
      const previous = current
      scrollportRef.current = next
      thumbModelRef.current = null
      lastFlowWidthRef.current = 0
      setHover(null)
      closeLoupe()
      if (previous !== null) previous.removeEventListener('scroll', onScroll)
      if (next !== null) next.addEventListener('scroll', onScroll, { passive: true })
      if (resizeObserver !== null) { resizeObserver.disconnect(); resizeObserver = null }
      if (next !== null && typeof ResizeObserver === 'function') {
        resizeObserver = new ResizeObserver(schedule)
        resizeObserver.observe(next)
      }
    }

    const compute = (): void => {
      pending = false
      rebindScrollport(resolveScrollport())
      const scrollport = scrollportRef.current
      if (scrollport === null || !scrollport.isConnected) {
        // 切换瞬间新容器尚未挂载：地图暂隐，稳定祖先的下一次观测会恢复它。
        if (draggingRef.current) { draggingRef.current = false; setDragging(false) }
        closeLoupe()
        setBox(null)
        setBars([])
        return
      }
      const rect = scrollport.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) {
        if (draggingRef.current) { draggingRef.current = false; setDragging(false) }
        closeLoupe()
        setBox(null)
        setBars([])
        return
      }
      const total = scrollport.scrollHeight
      const composer = scrollport.querySelector('[data-composer-seat]')
      const composerHeight = composer === null ? 0 : composer.getBoundingClientRect().height
      const sbw = scrollbarWidthOf(scrollport)
      const vw = window.innerWidth
      const avail = rect.height - composerHeight - 6
      // 地图高度随会话内容实时伸缩（内容基准与缩略图克隆同源 data-chat-flow）：
      // - 缩略图模式：恒为等比缩微高度（封顶可用高度），随内容连续增长无跳变；
      //   缩略图本身始终等比，超长内容在轨道内随滚动平移；
      // - 色块模式：仍按内容高度铺满轨道（封顶可用高度）。
      const flow = scrollport.querySelector('[data-chat-flow]')
      const flowRect = flow === null ? null : flow.getBoundingClientRect()
      const flowTopAbs = flowRect === null ? 0 : flowRect.top - rect.top + scrollport.scrollTop
      const contentH = flowRect === null
        ? Math.max(1, total - composerHeight)
        : Math.max(1, flowRect.height)
      const thumbScale = flowRect === null || flowRect.width <= 0
        ? 0
        : widthRef.current / flowRect.width
      const thumbH = Math.min(avail, contentH * thumbScale)
      setBox({
        right: Math.max(0, vw - rect.right + sbw + 2),
        top: rect.top + 2,
        height: thumbModeRef.current
          ? Math.max(THUMB_BOX_MIN, thumbH)
          : Math.max(80, Math.min(avail, contentH)),
        thumbH,
      })
      const rows = scrollport.querySelectorAll('[data-chat-anchor-key]')
      const list: Bar[] = []
      for (const row of rows) {
        const r = row.getBoundingClientRect()
        if (r.height <= 0) continue
        const contentTop = r.top - rect.top + scrollport.scrollTop
        list.push({
          key: row.getAttribute('data-chat-anchor-key') || '',
          kind: row.getAttribute('data-chat-flow-kind') || 'unknown',
          top: Math.max(0, (contentTop - flowTopAbs) / contentH),
          height: r.height / contentH,
          text: String(row.textContent || '').replace(/\s+/g, ' ').trim().slice(0, MAX_SNIPPET),
        })
      }
      setBars(list)
      {
        const vh = scrollport.clientHeight
        const vt = scrollport.scrollTop - flowTopAbs
        const nextViewport = {
          top: Math.min(1, Math.max(0, vt / contentH)),
          height: Math.min(1, Math.max(0.05, vh / contentH)),
        }
        viewportRef.current = nextViewport
        setViewport(nextViewport)
      }
      if (thumbModeRef.current) {
        const flowWidth = flowRect === null ? 0 : flowRect.width
        if (flowWidth !== lastFlowWidthRef.current) {
          // 内容宽度变化时缩放基数变了，强制重克隆。
          lastFlowWidthRef.current = flowWidth
          scheduleThumbClone(true)
        } else {
          scheduleThumbClone(false)
        }
      }
    }

    const mutation = typeof MutationObserver === 'function' ? new MutationObserver(schedule) : null
    if (mutation !== null) mutation.observe(watchRoot, { childList: true, subtree: true, characterData: true })
    window.addEventListener('resize', schedule)

    computeRef.current = compute
    compute()

    return () => {
      pending = true
      if (typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(rafId)
        if (thumbLoopRef.current !== 0) { window.cancelAnimationFrame(thumbLoopRef.current); thumbLoopRef.current = 0 }
      }
      thumbQueuedRef.current = false
      if (mutation !== null) mutation.disconnect()
      if (resizeObserver !== null) resizeObserver.disconnect()
      const current = scrollportRef.current
      if (current !== null) current.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', schedule)
      scrollportRef.current = null
      thumbModelRef.current = null
    }
  }, [])

  React.useEffect(() => {
    widthRef.current = width
    writeStored(STORAGE_WIDTH_KEY, String(Math.round(width)))
    const nextMode = width >= THUMB_MIN_WIDTH
    const prevMode = thumbModeRef.current
    thumbModeRef.current = nextMode
    if (nextMode && !prevMode) {
      setHover(null)
      closeLoupe()
      scheduleThumbClone(true)
    }
    if (!nextMode && prevMode) {
      thumbModelRef.current = null
      thumbQueuedRef.current = false
      closeLoupe()
    }
    // 缩略图模式下地图高度随宽度等比变化（box 高度依赖 width），重算一次盒。
    computeRef.current()
  }, [width])

  React.useEffect(() => {
    writeStored(STORAGE_COLLAPSED_KEY, collapsed ? '1' : '0')
    if (collapsed) { closeLoupe(); return }
    if (widthRef.current >= THUMB_MIN_WIDTH) scheduleThumbClone(true)
  }, [collapsed])

  React.useEffect(() => {
    if (collapsed || width < THUMB_MIN_WIDTH) return
    applyThumbScale()
    if (loupeOpenRef.current) {
      // 缩略图仿射变化（调宽/盒高变化）：重新反解光标位置，放大镜实时跟随。
      const refreshed = loupeStateAt(loupeScreenRef.current.x, loupeScreenRef.current.y)
      if (refreshed !== null) setLoupe(refreshed)
    }
  }, [width, box, collapsed])

  React.useEffect(() => {
    if (!loupeOpen) return
    // 面板挂载后首次填充内容并对准。
    rebuildLoupe()
    const refreshed = loupeStateAt(loupeScreenRef.current.x, loupeScreenRef.current.y)
    if (refreshed !== null) setLoupe(refreshed)
  }, [loupeOpen])

  const scrollToFraction = (clientY: number): void => {
    const sp = scrollportRef.current
    const root = rootRef.current
    if (sp === null || root === null) return
    const rect = root.getBoundingClientRect()
    if (rect.height <= 0) return
    let fraction = (clientY - rect.top) / rect.height
    fraction = Math.min(1, Math.max(0, fraction))
    const max = sp.scrollHeight - sp.clientHeight
    if (max > 0) sp.scrollTop = fraction * max
  }

  const onRootPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (collapsed) { setCollapsed(false); return }
    closeLoupe()
    draggingRef.current = true
    setDragging(true)
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch (_error) { /* pointer gone */ }
    scrollToFraction(event.clientY)
  }

  const onRootPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (draggingRef.current) { scrollToFraction(event.clientY); return }
    if (widthRef.current >= THUMB_MIN_WIDTH) {
      if (hover !== null) setHover(null)
      if (collapsed || resizingRef.current || thumbModelRef.current === null) { closeLoupe(); return }
      // 缩略图模式：光标处内容 1:1 放大预览，面板在光标左侧实时跟随。
      const next = loupeStateAt(event.clientX, event.clientY)
      if (next === null) { closeLoupe(); return }
      loupeScreenRef.current = { x: event.clientX, y: event.clientY }
      loupeOpenRef.current = true
      setLoupe(next)
      return
    }
    closeLoupe()
    const root = rootRef.current
    if (root === null) return
    const rect = root.getBoundingClientRect()
    const fraction = rect.height > 0
      ? Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
      : 0
    let found: Bar | null = null
    for (const bar of bars) {
      if (fraction >= bar.top && fraction <= bar.top + bar.height) { found = bar; break }
    }
    setHover(found)
  }

  const onRootPointerEnd = (): void => {
    draggingRef.current = false
    setDragging(false)
  }

  const onGripDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    event.stopPropagation()
    event.preventDefault()
    resizingRef.current = true
    setResizing(true)
    setHover(null)
    closeLoupe()
    resizeStartRef.current = { x: event.clientX, width: widthRef.current }
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch (_error) { /* pointer gone */ }
  }

  const onGripMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!resizingRef.current) return
    event.stopPropagation()
    const next = Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, resizeStartRef.current.width + (resizeStartRef.current.x - event.clientX)))
    widthRef.current = next
    setWidth(next)
  }

  const onGripEnd = (): void => {
    resizingRef.current = false
    setResizing(false)
  }

  const thumbMode = width >= THUMB_MIN_WIDTH
  if (box === null || box.height <= 0) return null

  const mapChildren: React.ReactNode[] = []
  if (collapsed) {
    mapChildren.push(React.createElement('div', {
      key: 'strip',
      className: 'dshcm-track dshcm-collapsed',
      title: '会话地图（已收起，点击展开）',
      'aria-label': '会话地图（已收起，点击展开）',
    }))
    // 收起态常显 « 展开标签：与收起按钮对称，向左溢出细条形成可见入口；
    // 点击标签或细条本身均可展开（细条展开由 root 的 onPointerDown 处理）。
    mapChildren.push(React.createElement('button', {
      key: 'expand',
      type: 'button',
      className: 'dshcm-toggle dshcm-toggle-expand',
      title: '展开会话地图',
      'aria-label': '展开会话地图',
      onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => { event.stopPropagation() },
      onClick: () => { setCollapsed(false) },
    }, '«'))
  } else if (thumbMode) {
    mapChildren.push(React.createElement('div', { key: 'thumb', ref: thumbRef, className: 'dshcm-thumb' }))
  } else {
    const barNodes: React.ReactNode[] = []
    for (let index = 0; index < bars.length; index += 1) {
      const bar = bars[index]
      barNodes.push(React.createElement('div', {
        key: bar.key || 'dshcm-bar-' + index,
        className: 'dshcm-bar dshcm-kind-' + bar.kind + (hover === bar ? ' dshcm-hovered' : ''),
        style: { top: bar.top * box.height, height: Math.max(2, bar.height * box.height) },
      }))
    }
    mapChildren.push(React.createElement('div', { key: 'track', className: 'dshcm-track' }, barNodes))
  }

  if (!collapsed && bars.length > 0) {
    // 指示条对齐缩微内容：缩略图模式用与 applyThumbScale 同源的仿射参数反推
    // 可见区在轨道内的位置（等比缩微 + 滚动平移）；首次克隆前或色块模式按
    // 整条轨道铺满。
    const t = thumbMode ? thumbTransform() : null
    if (t !== null) {
      const indicatorTop = t.ty + viewport.top * t.scaledH
      const indicatorHeight = Math.max(4, viewport.height * t.scaledH)
      mapChildren.push(React.createElement('div', {
        key: 'viewport',
        className: 'dshcm-viewport',
        style: {
          top: Math.max(0, Math.min(indicatorTop, box.height - indicatorHeight)),
          height: Math.min(indicatorHeight, box.height),
        },
      }))
    } else {
      mapChildren.push(React.createElement('div', {
        key: 'viewport',
        className: 'dshcm-viewport',
        style: {
          top: viewport.top * box.height,
          height: Math.max(20, viewport.height * box.height),
        },
      }))
    }
  }

  if (!collapsed) {
    mapChildren.push(React.createElement('div', {
      key: 'grip',
      className: 'dshcm-grip',
      title: '拖动调整宽度（≥' + THUMB_MIN_WIDTH + 'px 显示缩略图）',
      onPointerDown: onGripDown,
      onPointerMove: onGripMove,
      onPointerUp: onGripEnd,
      onPointerCancel: onGripEnd,
    }))
  }

  if (!collapsed) {
    mapChildren.push(React.createElement('button', {
      key: 'toggle',
      type: 'button',
      className: 'dshcm-toggle',
      title: '收起会话地图',
      'aria-label': '收起会话地图',
      onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => { event.stopPropagation() },
      onClick: () => { setCollapsed(true) },
    }, '»'))
  }

  if (resizing && !collapsed) {
    mapChildren.push(React.createElement('div', {
      key: 'badge',
      className: 'dshcm-badge',
      style: { right: box.right + width + 8, top: box.top + 6 },
    }, Math.round(width) + 'px · ' + (thumbMode ? '缩略图' : '色块')))
  }

  if (hover !== null && !collapsed && !dragging && !thumbMode) {
    mapChildren.push(React.createElement('div', {
      key: 'tooltip',
      className: 'dshcm-tooltip',
      style: {
        right: box.right + width + 12,
        top: Math.max(8, Math.min(window.innerHeight - 240, box.top + hover.top * box.height - 24)),
      },
    },
      React.createElement('div', { className: 'dshcm-tooltip-kind' }, KIND_LABELS[hover.kind] || '消息节点'),
      hover.text === '' ? null : React.createElement('div', { className: 'dshcm-tooltip-text' }, hover.text),
    ))
  }

  if (loupe !== null && thumbMode && !collapsed) {
    mapChildren.push(React.createElement('div', {
      key: 'loupe',
      className: 'dshcm-loupe',
      style: { width: LOUPE_W, height: LOUPE_H, left: loupe.left, top: loupe.top },
    },
      React.createElement('div', {
        ref: loupeInnerRef,
        className: 'dshcm-loupe-inner',
        style: { transform: 'translate(' + loupe.tx + 'px, ' + loupe.ty + 'px) scale(' + loupe.s + ')' },
      }),
    ))
  }

  return React.createElement('div', {
    ref: rootRef,
    className: 'dshcm-root' + (dragging ? ' dshcm-dragging' : '') + (resizing ? ' dshcm-resizing' : ''),
    style: { top: box.top, right: box.right, height: box.height, width: collapsed ? 4 : width },
    onPointerDown: onRootPointerDown,
    onPointerMove: onRootPointerMove,
    onPointerUp: onRootPointerEnd,
    onPointerCancel: onRootPointerEnd,
    onPointerLeave: () => { if (!draggingRef.current) { setHover(null); closeLoupe() } },
  }, mapChildren)
}

export const name = 'conversation-minimap'

/** 槽位服务是硬依赖：出现前由 Loader 等待。 */
export const inject = ['slots']

export function apply(ctx: PluginContext): void {
  // 样式随插件生命周期注入/移除（effect 返回清理函数）。
  ctx.effect(() => {
    if (typeof document === 'undefined') return
    const tag = document.createElement('style')
    tag.dataset.plugin = 'dsh-conversation-map'
    tag.dataset.pluginCss = 'dsh-conversation-map/minimap.css'
    tag.textContent = MINIMAP_CSS
    document.head.appendChild(tag)
    return () => { tag.remove() }
  })
  ctx.slots.inject('shell.overlay', () => ctx.slots.register(
    { name: 'shell.overlay', id: 'conversation-minimap', order: 10, label: () => '会话地图' },
    () => React.createElement(ConversationMinimap),
  ))
}
