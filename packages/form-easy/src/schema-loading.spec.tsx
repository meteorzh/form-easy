import { h } from '@stencil/core';
import { newSpecPage } from '@stencil/core/testing';
import { FormEasy } from './components/form-easy/form-easy';
import { FormEasyField } from './components/form-easy-field/form-easy-field';
import type { BasicFieldRenderer } from './renderers/basic-field-renderer';
import type { FormSchema } from './types';

/** loading 测试不需要挂载真实输入控件。 */
const noopRenderer: BasicFieldRenderer = {
  render: () => undefined,
  unmount: () => undefined
};

/** 创建一个只含单个基础字段的 schema。 */
function createSchema(key: string, fieldKey: string, name: string): FormSchema {
  return {
    key,
    name,
    fields: [
      {
        key: fieldKey,
        name: `${name}字段`,
        category: 'basic',
        dataType: 'string'
      }
    ]
  };
}

describe('表单 schema 切换 loading 状态', () => {
  it('schema 变化时依次发出 loading true 和 false，并渲染新字段', async () => {
    const page = await newSpecPage({
      components: [FormEasy, FormEasyField],
      template: () => (
        <form-easy
          schema={createSchema('loadingA', 'x', 'A')}
          basicFieldRenderer={noopRenderer}
        />
      )
    });
    await page.waitForChanges();
    const events: boolean[] = [];
    page.root!.addEventListener('formLoading', () => events.push(true));
    page.root!.addEventListener('formReady', () => events.push(false));

    page.root!.schema = createSchema('loadingB', 'y', 'B');
    await flushDeferredLoad(page);

    expect(events).toEqual([true, false]);
    expect(page.root!.querySelector('.form-schema-loading')).toBeNull();
    expect(page.root!.querySelectorAll('form-easy-field')).toHaveLength(1);
    expect(page.root!.querySelector('h2')?.textContent).toBe('B');
  });

  it('loading 期间渲染覆盖表单的蒙层和提示文字', async () => {
    const page = await newSpecPage({
      components: [FormEasy, FormEasyField],
      template: () => (
        <form-easy
          schema={createSchema('loadingC', 'z', 'C')}
          basicFieldRenderer={noopRenderer}
        />
      )
    });
    await page.waitForChanges();

    const instance = page.rootInstance as unknown as {
      schemaLoading: boolean;
      render(): unknown;
    };
    instance.schemaLoading = true;
    const rendered = instance.render() as {
      $children$?: Array<{ $attrs$?: { class?: string } } | null>;
    };
    const loadingNode = (rendered.$children$ ?? []).find(child => (
      child?.$attrs$?.class === 'form-schema-loading'
    ));
    const indicatorNode = (rendered.$children$ ?? []).find(child => (
      child?.$attrs$?.class === 'form-schema-loading-indicator'
    ));

    expect(loadingNode).toBeDefined();
    // 提示文字是蒙层的兄弟节点：蒙层上的 backdrop-filter 会创建新的包含块，
    // 放在蒙层内部的 fixed 元素会相对蒙层定位，而不是相对视口。
    expect(indicatorNode).toBeDefined();
    expect(
      (indicatorNode as { $children$?: unknown[] }).$children$
    ).toHaveLength(1);
  });
});

/** 等待 loading 让出一帧后完成的异步初始化。 */
async function flushDeferredLoad(page: {
  waitForChanges(): Promise<unknown>;
}): Promise<void> {
  // 重载工作循环会先让出一帧绘制蒙层，再让出一帧确认新内容已渲染，
  // 因此这里需要多推进几个周期。
  for (let i = 0; i < 12; i++) {
    await new Promise(resolve => { setTimeout(resolve, 0); });
    await page.waitForChanges();
  }
}
