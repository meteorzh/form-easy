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

/** 加载后不会被修改的完整值：每个非 optional 字段都已提供，optional 字段未启用。 */
const completeValue = {
  title: 'hello',
  profile: { name: 'n', address: { city: 'c' } },
  tags: ['a', 'b']
};

describe('表单加载后的 formChange', () => {
  /** 在挂载之前就开始监听，收集首次挂载起的全部事件。 */
  async function mountForm(value?: Record<string, unknown>): Promise<{
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
    if (value !== undefined) form.value = value;
    form.basicFieldRenderer = noopRenderer;
    page.body.appendChild(form);
    await flush(page);
    return { page, form, changes, order };
  }

  it('首次挂载的值没有被修改时，字段逐层挂载不会发出 formChange', async () => {
    const { changes, order } = await mountForm(completeValue);

    expect(order).toEqual(['loading', 'ready']);
    expect(changes).toEqual([]);
  });

  it('首次挂载的值被规范化时，在 formReady 之后发出一次完整数据', async () => {
    const { changes, order } = await mountForm({
      // 缺少 title、tags；legacy 不在 schema 中。
      profile: { name: 'n', address: { city: 'c' } },
      legacy: true
    });

    expect(order).toEqual(['loading', 'ready', 'change']);
    expect(changes).toHaveLength(1);
    expect(changes[0].fieldId).toBe('initA');
    expect(changes[0].formData).toEqual({
      title: null,
      profile: { name: 'n', address: { city: 'c' } },
      tags: null
    });
  });

  it('首次挂载未传入值时，发出一次按默认值生成的数据', async () => {
    const { changes } = await mountForm();

    expect(changes).toHaveLength(1);
    // 没有 defaultValue 的对象字段默认值为 null。
    expect(changes[0].formData).toEqual({ title: 't', profile: null, tags: null });
  });

  it('schema 变化后输出不同时发出一次，且保留复用字段的输出状态', async () => {
    const { page, form, changes, order } = await mountForm(completeValue);
    order.length = 0;
    const schema = createNestedSchema('initB');
    schema.fields.push({ key: 'extra', name: '新增', category: 'basic', dataType: 'string' });

    form.schema = schema;
    await flush(page);

    expect(order).toEqual(['loading', 'ready', 'change']);
    expect(changes).toHaveLength(1);
    // 复用的 optional 字段仍然不输出；新字段在传入值中缺失，补为 null。
    expect(changes[0].formData).toEqual({ ...completeValue, extra: null });
  });

  it('value 变化后没有被修改时不发出 formChange', async () => {
    const { page, form, changes, order } = await mountForm(completeValue);
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

  it('value 变化后被规范化时同样发出一次', async () => {
    const { page, form, changes, order } = await mountForm(completeValue);
    order.length = 0;

    form.value = { ...completeValue, title: 'changed', legacy: 1 };
    await flush(page);

    expect(order).toEqual(['loading', 'ready', 'change']);
    expect(changes[0].formData).toEqual({ ...completeValue, title: 'changed' });
  });
});
