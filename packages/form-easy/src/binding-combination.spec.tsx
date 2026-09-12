import { h } from '@stencil/core';
import { newSpecPage } from '@stencil/core/testing';
import { FormEasyField } from './components/form-easy-field/form-easy-field';
import { FormEasy } from './components/form-easy/form-easy';
import { EventCenter } from './managers/event-center';
import type { BasicFieldRenderer } from './renderers/basic-field-renderer';
import type { FormSchema } from './types';
import { validateFormSchema } from './validation/schema';

/** 创建只用于观察字段外层状态的测试渲染器。 */
function createTestRenderer(): BasicFieldRenderer {
  return {
    /** 测试无需挂载实际输入控件。 */
    render: () => undefined,
    /** 测试渲染器没有需要释放的框架实例。 */
    unmount: () => undefined
  };
}

/** 创建包含两个状态源和一个目标字段的测试表单。 */
function createBindingSchema(
  firstCombine: 'and' | 'or',
  secondCombine: 'and' | 'or',
  target: 'visible' | 'value' = 'visible'
): FormSchema {
  return {
    key: 'bindingCombinationForm',
    name: '绑定组合测试表单',
    fields: [
      {
        key: 'firstSource',
        name: '第一个绑定源',
        category: 'basic',
        dataType: 'boolean',
        defaultValue: false
      },
      {
        key: 'secondSource',
        name: '第二个绑定源',
        category: 'basic',
        dataType: 'boolean',
        defaultValue: false
      },
      {
        key: 'target',
        name: '绑定目标',
        category: 'basic',
        dataType: 'string',
        binds: [
          {
            sourceFormKey: 'bindingCombinationForm',
            sourceFieldId: './firstSource',
            target,
            combine: firstCombine
          },
          {
            sourceFormKey: 'bindingCombinationForm',
            sourceFieldId: './secondSource',
            target,
            combine: secondCombine
          }
        ]
      }
    ]
  };
}

describe('字段绑定组合方式', () => {
  it('允许多个 visible 绑定使用一致的 or 组合方式', () => {
    const result = validateFormSchema(createBindingSchema('or', 'or'));

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('拒绝相同目标混用不同组合方式', () => {
    const result = validateFormSchema(createBindingSchema('and', 'or'));

    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'conflicting-configuration' })
    ]));
  });

  it('仍然拒绝为 value 目标配置多个绑定源', () => {
    const result = validateFormSchema(
      createBindingSchema('and', 'and', 'value')
    );

    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'duplicate-binding' })
    ]));
  });

  it('任意一个 or 绑定源为真时显示目标字段', async () => {
    const page = await newSpecPage({
      components: [FormEasy, FormEasyField],
      template: () => (
        <form-easy
          schema={createBindingSchema('or', 'or')}
          eventCenter={new EventCenter()}
          basicFieldRenderer={createTestRenderer()}
        />
      )
    });
    await page.waitForChanges();

    const fields = Array.from(
      page.root!.querySelectorAll('form-easy-field')
    ) as Array<HTMLElement & {
      /** 执行字段支持的标准操作命令。 */
      applyHandle(handle: 'change', value: unknown): Promise<void>;
    }>;
    const firstSource = fields[0];
    const target = fields[2];
    expect(target.querySelector('.field')).toBeNull();

    await firstSource.applyHandle('change', true);
    await page.waitForChanges();
    expect(target.querySelector('.field')).not.toBeNull();

    await firstSource.applyHandle('change', false);
    await page.waitForChanges();
    expect(target.querySelector('.field')).toBeNull();
  });
});
