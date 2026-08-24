/**
 * dsh-conversation-map — Host 半身。
 *
 * 这是一个纯客户端插件：Host 侧没有行为。真正的 UI 半身在
 * exports["./client"]（构建产物 lib/client.js）中，由 web 插件表
 * （@deepseek-ai/dsh-client-modules 的 node half）扫描 package.json 的
 * dsh.client 声明后，通过 /plugins/<id>/client.js 提供给浏览器。
 */

export function apply(_ctx) {}
