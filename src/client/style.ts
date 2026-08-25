/**
 * 插件自有样式表。构建时内联为字符串，在 apply 中通过 ctx.effect 注入，
 * 插件卸载时随 effect 清理移除，不污染页面。
 */
export const MINIMAP_CSS = `
.dshcm-root{position:fixed;z-index:1200;pointer-events:auto;user-select:none;-webkit-user-select:none;touch-action:none;-webkit-tap-highlight-color:transparent;}
.dshcm-track{position:absolute;top:0;right:0;bottom:0;left:0;border-radius:8px;overflow:hidden;cursor:grab;background:rgba(127,136,150,.10);background:color-mix(in srgb,var(--dsw-alias-bg-layer-2,#7f8896) 16%,transparent);border:1px solid rgba(127,136,150,.14);border:1px solid color-mix(in srgb,var(--dsw-alias-border-l1,#7f8896) 60%,transparent);}
.dshcm-root.dshcm-dragging .dshcm-track{cursor:grabbing;}
.dshcm-track.dshcm-collapsed{border-radius:2px;cursor:pointer;border-color:transparent;background:color-mix(in srgb,var(--dsw-alias-bg-layer-2,#7f8896) 24%,transparent);border-left:1px solid color-mix(in srgb,var(--dsw-alias-border-l1,#7f8896) 45%,transparent);}
.dshcm-bar{position:absolute;left:1px;right:1px;border-radius:2px;opacity:.72;pointer-events:none;}
.dshcm-bar.dshcm-hovered{opacity:1;}
.dshcm-kind-user{background:var(--dsw-alias-brand-primary,#4c8dff);}
.dshcm-kind-assistant-step{background:var(--dsw-alias-label-secondary,#8a92a0);}
.dshcm-kind-tool-call{background:var(--dsw-alias-state-warn-primary,#d8a530);}
.dshcm-kind-turn-error{background:var(--dsw-alias-state-error-primary,#d9534f);}
.dshcm-kind-command,.dshcm-kind-command-input{background:var(--dsw-alias-state-success-primary,#3fa46a);}
.dshcm-kind-compaction,.dshcm-kind-context,.dshcm-kind-manual-compaction,.dshcm-kind-steering,.dshcm-kind-model-retry,.dshcm-kind-turn-tail,.dshcm-kind-turn-max-tokens,.dshcm-kind-unknown,.dshcm-kind-workflow-run{background:var(--dsw-alias-label-primary,#aeb4bf);opacity:.4;}
.dshcm-viewport{position:absolute;left:0;right:0;border-radius:7px;pointer-events:none;border:1px solid rgba(140,150,168,.45);border:1px solid color-mix(in srgb,var(--dsw-alias-label-secondary,#8a92a0) 50%,transparent);background:rgba(140,150,168,.10);background:color-mix(in srgb,var(--dsw-alias-label-primary,#aeb4bf) 12%,transparent);}
.dshcm-thumb{position:absolute;top:0;right:0;bottom:0;left:0;overflow:hidden;border-radius:8px;background:var(--dsw-alias-bg-base,#101319);border:1px solid color-mix(in srgb,var(--dsw-alias-border-l1,#7f8896) 60%,transparent);}
.dshcm-thumb,.dshcm-thumb *{pointer-events:none !important;user-select:none !important;}
.dshcm-thumb-inner{transform-origin:top left;overflow:hidden;}
.dshcm-loupe{position:fixed;z-index:1201;overflow:hidden;border-radius:10px;border:2px solid rgba(140,150,168,.55);border:2px solid color-mix(in srgb,var(--dsw-alias-border-l1,#7f8896) 85%,transparent);background:var(--dsw-alias-bg-base,#101319);box-shadow:0 0 24px 2px rgba(76,141,255,.22),0 16px 40px rgba(0,0,0,.45);box-shadow:0 0 24px 2px color-mix(in srgb,var(--dsw-alias-brand-primary,#4c8dff) 26%,transparent),0 16px 40px rgba(0,0,0,.45);}
.dshcm-loupe,.dshcm-loupe *{pointer-events:none !important;user-select:none !important;}
.dshcm-loupe-inner{position:absolute;top:0;left:0;transform-origin:top left;overflow:hidden;}
.dshcm-grip{position:absolute;top:0;bottom:0;left:-5px;width:10px;cursor:ew-resize;opacity:.4;transition:opacity 120ms ease;touch-action:none;}
.dshcm-grip::after{content:'';position:absolute;left:4px;top:10px;bottom:10px;width:2px;border-radius:1px;background:var(--dsw-alias-label-secondary,#8a92a0);opacity:.65;}
.dshcm-root:hover .dshcm-grip,.dshcm-root.dshcm-resizing .dshcm-grip{opacity:1;}
.dshcm-badge{position:fixed;pointer-events:none;z-index:1201;padding:3px 8px;border-radius:6px;font-size:11px;line-height:1.4;color:var(--dsw-alias-label-primary,#c6cbd4);background:var(--dsw-alias-bg-overlay,#171a21);border:1px solid var(--dsw-alias-border-l1,rgba(128,136,152,.28));box-shadow:0 6px 18px rgba(0,0,0,.25);white-space:nowrap;}
.dshcm-toggle{position:absolute;top:0;right:0;width:20px;height:18px;padding:0;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary,#8a92a0);font-size:10px;line-height:18px;cursor:pointer;opacity:0;transition:opacity 120ms ease;}
.dshcm-root:hover .dshcm-toggle{opacity:.85;}
.dshcm-toggle-expand{width:20px;height:22px;font-size:12px;line-height:22px;opacity:.9;color:var(--dsw-alias-label-primary,#c6cbd4);background:color-mix(in srgb,var(--dsw-alias-bg-overlay,#171a21) 88%,transparent);border:1px solid color-mix(in srgb,var(--dsw-alias-border-l1,#7f8896) 55%,transparent);border-radius:6px 4px 4px 6px;}
.dshcm-root:hover .dshcm-toggle-expand{opacity:1;}
.dshcm-tooltip{position:fixed;width:264px;max-height:230px;overflow:hidden;padding:8px 10px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1,rgba(128,136,152,.28));background:var(--dsw-alias-bg-overlay,#171a21);box-shadow:0 10px 30px rgba(0,0,0,.3);pointer-events:none;z-index:1201;}
.dshcm-tooltip-kind{font-size:10px;line-height:1.3;font-weight:600;color:var(--dsw-alias-brand-primary,#4c8dff);margin-bottom:4px;}
.dshcm-tooltip-text{font-size:11px;line-height:1.55;color:var(--dsw-alias-label-secondary,#9aa2b0);white-space:pre-wrap;word-break:break-word;}
`
