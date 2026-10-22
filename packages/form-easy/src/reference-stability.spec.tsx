import { h } from '@stencil/core';
import { newSpecPage } from '@stencil/core/testing';
import { FormEasy } from './components/form-easy/form-easy';
import { FormEasyArray } from './components/form-easy-array/form-easy-array';
import { FormEasyField } from './components/form-easy-field/form-easy-field';
import { FormEasyObject } from './components/form-easy-object/form-easy-object';
import { FormEasyRecord } from './components/form-easy-record/form-easy-record';
import type { BasicFieldRenderer } from './renderers/basic-field-renderer';
import type { FormSchema } from './types';

/** 引用稳定性测试不需要挂载真实控件。 */
const noopRenderer: BasicFieldRenderer = {
  render: () => undefined,
  unmount: () => undefined
};

/** 渲染一个同时包含对象、数组和 record 的表单。 */
async function renderForm(schema: FormSchema) {
  const page = await newSpecPage({
    components: [FormEasy, FormEasyField, FormEasyObject, FormEasyArray, FormEasyRecord],
    template: () => (
      <form-easy schema={schema} basicFieldRenderer={noopRenderer} />
    )
  });
  await page.waitForChanges();
  return page;
}

/** 读取宿主元素收到的全部 valueChange 详情。 */
function captureValueChanges(element: Element): unknown[] {
  const changes: unknown[] = [];
  element.addEventListener('valueChange', event => {
    changes.push((event as CustomEvent<unknown>).detail);
  });
  return changes;
}

describe('字段变化保持值引用稳定', () => {
  it('顶层字段变化不替换表单 formData 引用', async () => {
    const page = await renderForm({
      key: 'stableForm',
      name: '稳定引用',
      fields: [
        { key: 'title', name: '标题', category: 'basic', dataType: 'string' }
      ]
    });
    const form = page.rootInstance as unknown as {
      formData: Record<string, unknown>;
    };
    const formData = form.formData;
    const field = page.root!.querySelector('form-easy-field')!;

    field.dispatchEvent(new CustomEvent('valueChange', { detail: 'changed' }));
    await page.waitForChanges();

    expect(form.formData).toBe(formData);
    expect(form.formData.title).toBe('changed');
  });

  it('对象和数组的下层字段变化不替换容器引用', async () => {
    const page = await renderForm({
      key: 'containerForm',
      name: '容器引用',
      fields: [
        {
          key: 'profile',
          name: '资料',
          category: 'object',
          defaultValue: { nickname: 'a' },
          fields: [
            {
              key: 'nickname',
              name: '昵称',
              category: 'basic',
              dataType: 'string'
            }
          ]
        },
        {
          key: 'items',
          name: '列表',
          category: 'array',
          defaultValue: [{ label: 'a' }],
          element: {
            category: 'object',
            fields: [
              {
                key: 'label',
                name: '名称',
                category: 'basic',
                dataType: 'string'
              }
            ]
          }
        }
      ]
    });
    const objectElement = page.root!.querySelector('form-easy-object')!;
    const arrayElement = page.root!.querySelector('form-easy-array')!;
    const objectChanges = captureValueChanges(objectElement);
    const arrayChanges = captureValueChanges(arrayElement);

    objectElement.querySelector('form-easy-field')!.dispatchEvent(
      new CustomEvent('valueChange', { detail: 'b' })
    );
    objectElement.querySelector('form-easy-field')!.dispatchEvent(
      new CustomEvent('valueChange', { detail: 'c' })
    );
    arrayElement.querySelector('form-easy-field')!.dispatchEvent(
      new CustomEvent('valueChange', { detail: 'd' })
    );
    arrayElement.querySelector('form-easy-field')!.dispatchEvent(
      new CustomEvent('valueChange', { detail: 'e' })
    );
    await page.waitForChanges();

    expect(objectChanges).toHaveLength(2);
    expect(objectChanges[0]).toBe(objectChanges[1]);
    expect(arrayChanges).toHaveLength(2);
    expect(arrayChanges[0]).toBe(arrayChanges[1]);
  });

  it('record 的值字段变化不替换 record 对象引用', async () => {
    const page = await renderForm({
      key: 'recordForm',
      name: '动态属性',
      fields: [
        {
          key: 'bag',
          name: '背包',
          category: 'record',
          defaultValue: { sword: 'a' },
          kvDef: {
            key: {},
            value: { category: 'basic', dataType: 'string' }
          }
        }
      ]
    });
    const recordElement = page.root!.querySelector('form-easy-record')!;
    const changes = captureValueChanges(recordElement);
    const valueField = Array.from(
      recordElement.querySelectorAll('form-easy-field')
    )[1];

    valueField.dispatchEvent(new CustomEvent('valueChange', { detail: 'b' }));
    valueField.dispatchEvent(new CustomEvent('valueChange', { detail: 'c' }));
    await page.waitForChanges();

    expect(changes).toHaveLength(2);
    expect(changes[0]).toBe(changes[1]);
  });
});
