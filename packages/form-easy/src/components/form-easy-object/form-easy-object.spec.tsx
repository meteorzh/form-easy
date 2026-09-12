import { h } from '@stencil/core';
import { newSpecPage } from '@stencil/core/testing';
import type { BasicFieldRenderer } from '../../renderers/basic-field-renderer';
import type { ComponentHandle } from '../../types';
import { FormEasyField } from '../form-easy-field/form-easy-field';
import { FormEasyObject } from './form-easy-object';

/** 创建无需挂载实际输入控件的对象计数测试渲染器。 */
function createTestRenderer(): BasicFieldRenderer {
  return {
    /** 对象计数测试无需渲染具体输入控件。 */
    render: () => undefined,
    /** 测试渲染器没有需要释放的框架实例。 */
    unmount: () => undefined
  };
}

describe('对象字段摘要计数', () => {
  it('区分当前可见的直接子字段数和 Schema 直接子字段总数', async () => {
    const page = await newSpecPage({
      components: [FormEasyObject, FormEasyField],
      template: () => (
        <form-easy-object
          fields={[
            {
              key: 'first',
              name: '第一个字段',
              category: 'basic',
              dataType: 'string'
            },
            {
              key: 'second',
              name: '第二个字段',
              category: 'basic',
              dataType: 'string'
            }
          ]}
          fieldId="objectForm.profile"
          formKey="objectForm"
          value={{ first: null, second: null }}
          basicFieldRenderer={createTestRenderer()}
        />
      )
    });
    await page.waitForChanges();

    const getSummary = (): string => page.root!
      .querySelector('.object-toggle span')!
      .textContent!;
    const fields = Array.from(
      page.root!.querySelectorAll('form-easy-field')
    ) as Array<HTMLElement & {
      /** 执行字段支持的标准操作命令。 */
      applyHandle(handle: ComponentHandle): Promise<void>;
    }>;

    expect(getSummary()).toBe('共 2 个字段');

    await fields[1].applyHandle('hide');
    await page.waitForChanges();
    expect(getSummary()).toBe('1 个可见字段 / 共 2 个字段');

    await fields[1].applyHandle('show');
    await page.waitForChanges();
    expect(getSummary()).toBe('共 2 个字段');
  });
});
