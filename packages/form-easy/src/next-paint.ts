/**
 * 等待浏览器完成一帧绘制。
 *
 * 同步初始化会阻塞渲染线程；先让出一帧，loading 蒙层才能真正显示出来，
 * 否则蒙层只会在重活结束后随结果一起出现。
 */
export function waitForNextPaint(): Promise<void> {
  return new Promise(resolve => {
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      resolve();
    };
    if (typeof requestAnimationFrame !== 'function') {
      setTimeout(finish, 0);
      return;
    }
    // 标签页切到后台时 requestAnimationFrame 会被挂起，Promise 永远不会兑现，
    // 蒙层会一直停在那里。这里用定时器兜底，保证加载流程一定能继续。
    const fallback = setTimeout(finish, 100);
    requestAnimationFrame(() => {
      // 关键：不能在同一个 rAF 回调里直接继续。
      // 框架的渲染任务同样挂在 rAF 队列上，如果这里直接 resolve，
      // 重活会在蒙层真正绘制之前跑完，蒙层就来不及显示了。
      // 连续两帧之后再等到下一个宏任务，确保本帧的样式变更已经提交给渲染管线。
      requestAnimationFrame(() => {
        setTimeout(() => {
          clearTimeout(fallback);
          finish();
        }, 0);
      });
    });
  });
}
