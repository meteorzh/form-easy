import { h } from '@stencil/core';
import { newSpecPage } from '@stencil/core/testing';
import type { BasicFieldRenderer } from '../../renderers/basic-field-renderer';
import { FormEasyField } from '../form-easy-field/form-easy-field';
import { FormEasyArray } from './form-easy-array';

/** 创建无需挂载实际输入控件的数组交互测试渲染器。 */
function createTestRenderer(): BasicFieldRenderer {
  return {
    /** 数组折叠测试无需渲染具体输入控件。 */
    render: () => undefined,
    /** 测试渲染器没有需要释放的框架实例。 */
    unmount: () => undefined
  };
}

describe('数组字段展开与收起', () => {
  it('支持独立收起数组项并通过顶层按钮统一展开和收起', async () => {
    const page = await newSpecPage({
      components: [FormEasyArray, FormEasyField],
      template: () => (
        <form-easy-array
          field={{
            key: 'items',
            name: '数组',
            category: 'array',
            element: {
              category: 'basic',
              dataType: 'string'
            }
          }}
          fieldId="arrayForm.items"
          formKey="arrayForm"
          value={['第一项', '第二项']}
          basicFieldRenderer={createTestRenderer()}
        />
      )
    });
    await page.waitForChanges();

    const getContents = (): HTMLElement[] => Array.from(
      page.root!.querySelectorAll('.array-item-content')
    );
    const getItemToggles = (): HTMLButtonElement[] => Array.from(
      page.root!.querySelectorAll('.array-item-toggle')
    );
    const getAllItemsToggle = (): HTMLButtonElement => page.root!.querySelector(
      '.array-action--items-toggle'
    )!;

    expect(getContents().every(content => !content.hidden)).toBe(true);

    getItemToggles()[0].click();
    await page.waitForChanges();
    expect(getContents()[0].hidden).toBe(true);
    expect(getContents()[1].hidden).toBe(false);
    expect(getAllItemsToggle().textContent).toContain('展开各项');

    getAllItemsToggle().click();
    await page.waitForChanges();
    expect(getContents().every(content => !content.hidden)).toBe(true);
    expect(getAllItemsToggle().textContent).toContain('收起各项');

    getAllItemsToggle().click();
    await page.waitForChanges();
    expect(getContents().every(content => content.hidden)).toBe(true);
  });
});
