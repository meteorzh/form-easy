import { h } from '@stencil/core';
import { newSpecPage } from '@stencil/core/testing';
import { FormEasy } from './components/form-easy/form-easy';
import { FormEasyField } from './components/form-easy-field/form-easy-field';
import type { BasicFieldRenderer } from './renderers/basic-field-renderer';
import type { FormChangeDetail, FormSchema } from './types';

describe('命名字段 omitWhenHidden 输出策略', () => {
  it('隐藏时省略输出，重新显示后恢复字段原始值', async () => {
    const schema: FormSchema = {
      key: 'visibilityForm',
      name: '可见状态表单',
      fields: [
        {
          key: 'conditional',
          name: '条件字段',
          category: 'basic',
          dataType: 'string',
          defaultValue: '保留的值',
          omitWhenHidden: true
        }
      ]
    };
    const renderer: BasicFieldRenderer = {
      /** 测试只关心字段状态和输出，不需要创建实际输入控件。 */
      render: () => undefined,
      /** 测试渲染器没有需要释放的框架实例。 */
      unmount: () => undefined
    };
    const page = await newSpecPage({
      components: [FormEasy, FormEasyField],
      template: () => (
        <form-easy schema={schema} basicFieldRenderer={renderer} />
      )
    });
    await page.waitForChanges();

    const changes: FormChangeDetail[] = [];
    page.root!.addEventListener('formChange', event => {
      changes.push((event as CustomEvent<FormChangeDetail>).detail);
    });
    const field = page.root!.querySelector('form-easy-field') as HTMLElement & {
      /** 执行字段支持的标准操作命令。 */
      applyHandle(handle: 'show' | 'hide'): Promise<void>;
      /** 根表单传给字段的原始值。 */
      value: unknown;
    };

    await field.applyHandle('hide');
    await page.waitForChanges();
    expect(changes.at(-1)?.formData).toEqual({});
    expect(field.value).toBe('保留的值');

    await field.applyHandle('show');
    await page.waitForChanges();
    expect(changes.at(-1)?.formData).toEqual({
      conditional: '保留的值'
    });
    expect(field.value).toBe('保留的值');
  });
});
