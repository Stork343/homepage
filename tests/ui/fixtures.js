// 测试与第三方端点解耦的共享夹具。
//
// 背景（2026-09-28 实测）：busuanzi 的 JSONP 回调脚本在 defer 阶段插入文档，
// 会推迟 window load；其数据端点间歇性挂起（8 次首屏加载 6 次 load >15s），
// 而 page.goto / page.reload 默认等待 load，导致本地回归结构性超时、CI 偶发红。
// 产品侧已把计数器改为 window load 之后注入（见 index.html 内联脚本），
// 此处再按「纵深防御」把计数/统计端点直接拦截，让 UI 测试永不依赖外网心情。
//
// 注意只拦这两个域名：
//   · Google Fonts 不能拦 —— 视觉基线在真实字体下录制，拦掉会改变渲染；
//   · jsdelivr（pdfjs-dist）不能拦 —— 阅读页运行时依赖其 viewer。
const { test: base, expect } = require('@playwright/test');

const BLOCKED = [/busuanzi\.ibruce\.info/, /plausible\.io/];

const test = base.extend({
  context: async ({ context }, use) => {
    await context.route(
      (url) => BLOCKED.some((re) => re.test(url)),
      (route) => route.abort()
    );
    await use(context);
  }
});

module.exports = { test, expect };
