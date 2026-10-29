import { h } from '@stencil/core';
import { newSpecPage } from '@stencil/core/testing';
import { FormEasyCreator } from './components/creator/form-easy-creator';
import type { FormEasyCreatorChangeDetail } from './components/creator/types';
import type { FormSchema } from './types';

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

/** 推进若干个宏任务与渲染周期，等待异步载入完成。 */
async function flush(page: {
  waitForChanges(): Promise<unknown>;
}): Promise<void> {
  for (let i = 0; i < 12; i++) {
    await new Promise(resolve => { setTimeout(resolve, 0); });
    await page.waitForChanges();
  }
}

describe('设计器在生命周期之间收到 value', () => {
  const originalWillLoad = FormEasyCreator.prototype.componentWillLoad;

  afterEach(() => {
    FormEasyCreator.prototype.componentWillLoad = originalWillLoad;
  });

  it('componentWillLoad 之后才写入的 value 会补载，不会停留在默认表单', async () => {
    const saved = createSchema('scriptDemo', 'topic');
    // 模拟组件代码已缓存的再次挂载：componentWillLoad 先用空 value 载入默认表单，
    // 使用方的 value 在 componentDidLoad 之前才写入。
    FormEasyCreator.prototype.componentWillLoad = function (this: FormEasyCreator): void {
      originalWillLoad.call(this);
      this.value = saved;
    };
    const page = await newSpecPage({
      components: [FormEasyCreator],
      template: () => <form-easy-creator />
    });
    const changes: FormEasyCreatorChangeDetail[] = [];
    page.root!.addEventListener('schemaChange', event => {
      changes.push((event as CustomEvent<FormEasyCreatorChangeDetail>).detail);
    });
    await flush(page);

    const creator = page.root as HTMLElement & {
      getSchema(): Promise<FormSchema>;
    };
    expect((await creator.getSchema()).key).toBe('scriptDemo');
    // 默认表单不能被当作编辑结果发出去。
    expect(changes.every(change => change.schema.key === 'scriptDemo')).toBe(true);
  });
});
