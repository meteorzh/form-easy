import { h } from '@stencil/core';
import { newSpecPage } from '@stencil/core/testing';
import { FormEasyCreator } from './components/creator/form-easy-creator';
import type { FormLoadingDetail, FormSchema } from './types';

/** 创建一个只含单个基础字段的 schema。 */
function createSchema(key: string, fieldKey: string): FormSchema {
  return {
    key,
    name: key.toUpperCase(),
    fields: [
      {
        key: fieldKey,
        name: `${fieldKey}字段`,
        category: 'basic',
        dataType: 'string'
      }
    ]
  };
}

/** 推进若干个宏任务与渲染周期，等待异步重载完成。 */
async function flush(page: {
  waitForChanges(): Promise<unknown>;
}): Promise<void> {
  for (let i = 0; i < 12; i++) {
    await new Promise(resolve => { setTimeout(resolve, 0); });
    await page.waitForChanges();
  }
}

describe('设计器 loading 事件隔离', () => {
  it('设计器内部动态表单的 loading 事件不会冒泡到设计器宿主', async () => {
    const page = await newSpecPage({
      components: [FormEasyCreator],
      template: () => <form-easy-creator value={createSchema('outer', 'x')} />
    });
    await page.waitForChanges();
    const events: Array<FormLoadingDetail & { loading: boolean }> = [];
    page.root!.addEventListener('formLoading', event => {
      events.push({ ...(event as CustomEvent<FormLoadingDetail>).detail, loading: true });
    });
    page.root!.addEventListener('formReady', event => {
      events.push({ ...(event as CustomEvent<FormLoadingDetail>).detail, loading: false });
    });

    (page.root as any).value = createSchema('outer2', 'y');
    await flush(page);

    // 设计器自身只应该发出一对 formLoading / formReady 事件。
    expect(events).toHaveLength(2);
    expect(events[0].loading).toBe(true);
    expect(events[1].loading).toBe(false);
    // 事件指向被载入的表单，而不是设计器内部驱动界面用的表单。
    expect(events[0].formKey).toBe('outer2');
    expect(events[1].formKey).toBe('outer2');
  });

  it('设计器内部动态表单的 formReady 事件不会冒泡到设计器宿主', async () => {
    const page = await newSpecPage({
      components: [FormEasyCreator],
      template: () => <form-easy-creator value={createSchema('readyOuter', 'x')} />
    });
    await page.waitForChanges();
    const ready: string[] = [];
    page.root!.addEventListener('formReady', event => {
      ready.push((event as CustomEvent<{ formKey: string }>).detail.formKey);
    });

    (page.root as any).value = createSchema('readyOuter2', 'y');
    await flush(page);

    // 只应该收到设计器自己发出的那一次。
    expect(ready).toEqual(['readyOuter2']);
  });
});
