/**
 * 缩略图几何：纯函数、无 DOM 依赖，供浏览器半身调用。
 *
 * 集中"缩放定标"、"内容框矩形"与"垂直平移"三条几何规则，保证渲染、量测、指针换算
 * 共用同一处真源；抽成纯函数也让这几条规则能直接被 Node 脚本验证（见各函数的不变量说明）。
 */

/**
 * 缩略图缩放比例：恒定「容器宽 / 内容宽」（上限 1，不为放大内容而缩）。
 *
 * 会话长度**不参与**定标——这是超长会话不被压成细线的关键：内容再高，缩略图
 * 都保持与地图宽度可比的清晰度，超出轨道的内容由纵向平移浏览（minimap 语义）。
 * 容器宽或内容宽非正（未克隆 / 未布局）时返回 0，由调用方视为"无可渲染缩略图"。
 */
export function thumbScaleFor(containerWidth: number, contentWidth: number): number {
  if (containerWidth <= 0 || contentWidth <= 0) return 0
  return Math.min(1, containerWidth / contentWidth)
}

/** 缩略图的仿射参数：等比缩放 s，垂直平移 ty（内容高于容器时随滚动平移）。 */
export interface ThumbTransform {
  s: number
  ty: number
  scaledH: number
  /** 内容框渲染高度（px，= 可见带高 × s，钳制在轨道内）：屏幕上那段内容的缩影。 */
  viewportH: number
  /** 内容框渲染顶边（px，相对轨道顶，= 滚动进度 × 行程）：到顶贴轨道顶、到底贴轨道底。 */
  viewportTop: number
  /** 内容框的可行程（= 轨道高 − 框高）：拖动时反解滚动量的基数。 */
  frameRange: number
  /** 内容坐标下的可滚动跨度（= 内容高 − 可见带高，下限 1）：框位 ↔ 内容坐标的换算基数。 */
  contentSpan: number
}

/**
 * 计算缩略图的缩放、内容框矩形与垂直平移。
 *
 * - 缩放恒由宽度决定（见 thumbScaleFor），与会话长度无关；
 * - 内容框 = **屏幕上可见那段内容的缩影**：高 = 可见带与内容的重叠高 × s，顶边按滚动
 *   进度铺满行程（进度 0 贴住轨道顶，进度 1 贴住轨道底），因此拖动它与滚动严格互逆；
 * - 垂直平移由内容框**反推**（ty = 框顶 − 该框所框内容坐标 × s），于是框内所见恒等于
 *   屏幕所见——不变量：ty + 可见段顶端内容坐标 × s === viewportTop。
 *   端点也随之自然成立：进度 0 时内容顶贴轨道顶（ty = 0），进度 1 时内容底贴轨道底
 *   （ty = 容器高 − scaledH），不需要额外的钳制（钳制反而会让框与内容错位）；
 * - 整段内容缩微后装得下轨道时整段居中显示、没有可拖动的行程，框仍按同一条不变量
 *   画在内容矩形上（内容比屏幕还高时框会在这张静态缩略图上滑动标明可见段）。
 *
 * visibleTopPx / visiblePx 都是**内容像素**（与 bars、悬停提示同一坐标系）：前者是可见带
 * 顶端的内容坐标（内容流上方可能还有内边距，故调用方给的值可为负；内部按 [0, contentSpan]
 * 收敛），后者是可见带高度（滚动容器可视高减去底部输入区遮挡的那一段）。
 *
 * 同时输出内容框在轨道内的矩形（viewportTop / viewportH），与 ty 同源，故框与缩略图不会错位。
 *
 * 不变量：s > 0；ty + contentTop × s === viewportTop；viewportTop ∈ [0, 容器高 − viewportH]；
 * 未居中（内容高于容器）时 ty ∈ [容器高 − scaledH, 0]。
 */
export function thumbTransformFor(
  containerWidth: number,
  containerHeight: number,
  contentWidth: number,
  contentHeight: number,
  visibleTopPx: number,
  visiblePx: number,
  scale?: number,
): ThumbTransform | null {
  if (containerWidth <= 0 || containerHeight <= 0) return null
  const s = scale === undefined ? thumbScaleFor(containerWidth, contentWidth) : scale
  if (s <= 0) return null
  const scaledH = contentHeight * s
  const contentSpan = Math.max(1, contentHeight - visiblePx)
  const contentTop = Math.min(Math.max(0, visibleTopPx), contentSpan)
  // 内容缩微后装得下轨道：整段居中显示，没有可拖动的行程。
  const fits = scaledH <= containerHeight
  const ty = fits ? (containerHeight - scaledH) / 2 : 0
  // 框高 = 可见带与内容的重叠部分 × s（整段可见时即剩下的整段内容），再钳制在轨道内。
  const visibleH = Math.max(1, Math.min(
    containerHeight,
    Math.min(visiblePx, contentHeight - contentTop) * s,
  ))
  const progress = Math.min(1, contentTop / contentSpan)
  if (fits) {
    return {
      s,
      ty,
      scaledH,
      viewportH: visibleH,
      viewportTop: ty + contentTop * s,
      frameRange: 0,
      contentSpan,
    }
  }
  const frameRange = Math.max(0, containerHeight - visibleH)
  const viewportTop = frameRange <= 0 ? 0 : progress * frameRange
  return {
    s,
    // 平移由框位反推：框顶恰好落在这段内容缩微后被渲染的位置上（见上方不变量）。
    ty: viewportTop - progress * contentSpan * s,
    scaledH,
    viewportH: visibleH,
    viewportTop,
    frameRange,
    contentSpan,
  }
}

/**
 * 由内容框的渲染顶边（**轨道坐标**）反解**屏幕可见段顶端的内容坐标**（内容像素）。
 *
 * 框按滚动进度铺满行程（见 thumbTransformFor 的 viewportTop），因此这里是它严格可逆的
 * 反函数：拖动框时框顶 1:1 跟手、不漂移；调用方把结果加上内容流在滚动坐标系里的偏移
 * 即为 scrollTop。行程为 0（框无处可拖，例如可见带已经盖住整条轨道）时返回 null。
 */
export function thumbFrameToContentTop(t: ThumbTransform, frameTop: number): number | null {
  if (t.frameRange <= 0) return null
  return Math.min(1, Math.max(0, frameTop / t.frameRange)) * t.contentSpan
}
