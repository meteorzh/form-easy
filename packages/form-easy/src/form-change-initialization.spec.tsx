import { newSpecPage } from '@stencil/core/testing';
import { FormEasy } from './components/form-easy/form-easy';
import { FormEasyArray } from './components/form-easy-array/form-easy-array';
import { FormEasyField } from './components/form-easy-field/form-easy-field';
import { FormEasyObject } from './components/form-easy-object/form-easy-object';
import type { BasicFieldRenderer } from './renderers/basic-field-renderer';
import type { FormChangeDetail, FormSchema } from './types';

/** 初始化测试不需要挂载真实输入控件。 */
const noopRenderer: BasicFieldRenderer = {
  render: () => undefined,
  unmount: () => undefined
};

/** 含嵌套对象、optional 子字段和数组的 schema，字段会逐层挂载。 */
function createNestedSchema(key: string): FormSchema {
  return {
    key,
    name: key,
    fields: [
      { key: 'title', name: '标题', category: 'basic', dataType: 'string', defaultValue: 't' },
      {
        key: 'profile',
        name: '资料',
        category: 'object',
        fields: [
          { key: 'name', name: '姓名', category: 'basic', dataType: 'string' },
          { key: 'nick', name: '昵称', category: 'basic', dataType: 'string', optional: true },
          {
            key: 'address',
            name: '地址',
            category: 'object',
            fields: [
              { key: 'city', name: '城市', category: 'basic', dataType: 'string' },
              { key: 'zip', name: '邮编', category: 'basic', dataType: 'string', optional: true }
            ]
          }
        ]
      },
      {
        key: 'tags',
        name: '标签',
        category: 'array',
        element: { category: 'basic', dataType: 'string' }
      }
    ]
  };
}

type FormEasyTestElement = HTMLElement & {
  schema?: FormSchema;
  value?: Record<string, unknown>;
  basicFieldRenderer?: BasicFieldRenderer;
};

/** 推进足够多的宏任务与渲染周期，等待初始化和重载全部完成。 */
async function flush(page: { waitForChanges(): Promise<unknown> }): Promise<void> {
  for (let i = 0; i < 40; i++) {
    await new Promise(resolve => { setTimeout(resolve, 0); });
    await page.waitForChanges();
  }
}

describe('表单加载期间的 formChange', () => {
  /** 在挂载之前就开始监听，收集首次挂载起的全部 formChange。 */
  async function mountForm(): Promise<{
    page: Awaited<ReturnType<typeof newSpecPage>>;
    form: FormEasyTestElement;
    changes: FormChangeDetail[];
    order: string[];
  }> {
    const page = await newSpecPage({
      components: [FormEasy, FormEasyField, FormEasyObject, FormEasyArray],
      html: '<div></div>'
    });
    const changes: FormChangeDetail[] = [];
    const order: string[] = [];
    const form = page.doc.createElement('form-easy') as FormEasyTestElement;
    form.addEventListener('formChange', event => {
      changes.push((event as CustomEvent<FormChangeDetail>).detail);
      order.push('change');
    });
    form.addEventListener('formLoading', () => order.push('loading'));
    form.addEventListener('formReady', () => order.push('ready'));
    form.schema = createNestedSchema('initA');
    form.value = {
      title: 'hello',
      profile: { name: 'n', address: { city: 'c' } },
      tags: ['a', 'b']
    };
    form.basicFieldRenderer = noopRenderer;
    page.body.appendChild(form);
    await flush(page);
    return { page, form, changes, order };
  }

  it('首次挂载按 schema 加载处理，字段逐层上报的变化在 formReady 之后只发出一次', async () => {
    const { changes, order } = await mountForm();

    expect(order).toEqual(['loading', 'ready', 'change']);
    expect(changes).toHaveLength(1);
    // 发出的是初始化结束时的完整输出：未提供的 optional 字段不输出。
    expect(changes[0].formData).toEqual({
      title: 'hello',
      profile: { name: 'n', address: { city: 'c' } },
      tags: ['a', 'b']
    });
  });

  it('重新加载期间的变化在 formReady 之后只发出一次，且保留字段的输出状态', async () => {
    const { page, form, changes, order } = await mountForm();
    changes.length = 0;
    order.length = 0;

    form.schema = createNestedSchema('initB');
    await flush(page);

    expect(changes).toHaveLength(1);
    expect(order).toEqual(['loading', 'ready', 'change']);
    // value 未变，新结构沿用原值；复用的 optional 字段仍然不输出。
    expect(changes[0].formData).toEqual({
      title: 'hello',
      profile: { name: 'n', address: { city: 'c' } },
      tags: ['a', 'b']
    });
  });

  it('value 变化导致的加载结束后不上报 formChange', async () => {
    const { page, form, changes, order } = await mountForm();
    changes.length = 0;
    order.length = 0;

    form.value = {
      title: 'changed',
      profile: { name: 'n2', nick: 'k', address: { city: 'c2', zip: 'z' } },
      tags: ['x']
    };
    await flush(page);

    expect(order).toEqual(['loading', 'ready']);
    expect(changes).toEqual([]);
  });
});
