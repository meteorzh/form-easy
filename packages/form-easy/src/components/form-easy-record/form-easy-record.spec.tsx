import { h } from '@stencil/core';
import { newSpecPage } from '@stencil/core/testing';
import type { BasicFieldRenderer } from '../../renderers/basic-field-renderer';
import { FormEasyField } from '../form-easy-field/form-easy-field';
import { FormEasyRecord } from './form-easy-record';

/** 创建无需挂载实际输入控件的 record 交互测试渲染器。 */
function createTestRenderer(): BasicFieldRenderer {
  return {
    /** 折叠测试只检查条目容器和标题。 */
    render: () => undefined,
    /** 测试渲染器没有需要释放的框架实例。 */
    unmount: () => undefined
  };
}

describe('record 键值项展开与收起', () => {
  it('使用可折叠容器，收起后标题只展示当前键值', async () => {
    const page = await newSpecPage({
      components: [FormEasyRecord, FormEasyField],
      template: () => (
        <form-easy-record
          field={{
            key: 'metadata',
            name: '动态属性',
            category: 'record',
            kvDef: {
              key: {},
              value: {
                category: 'basic',
                dataType: 'string'
              }
            }
          }}
          fieldId="recordForm.metadata"
          formKey="recordForm"
          value={{ environment: 'production', owner: '' }}
          basicFieldRenderer={createTestRenderer()}
        />
      )
    });
    await page.waitForChanges();

    const getContents = (): HTMLElement[] => Array.from(
      page.root!.querySelectorAll('.record-entry-content')
    );
    const getToggles = (): HTMLButtonElement[] => Array.from(
      page.root!.querySelectorAll('.record-entry-toggle')
    );
    const getSummaries = (): string[] => Array.from(
      page.root!.querySelectorAll('.record-entry-summary')
    ).map(summary => summary.textContent ?? '');

    expect(getContents().every(content => !content.hidden)).toBe(true);
    expect(getSummaries()).toEqual(['environment：production', 'owner']);

    getToggles()[0].click();
    await page.waitForChanges();

    expect(getContents()[0].hidden).toBe(true);
    expect(getContents()[1].hidden).toBe(false);
    expect(page.root!.querySelector('.record-entry.is-collapsed .record-entry-summary')
      ?.textContent).toBe('environment：production');
    expect(page.root!.querySelector('.record-items-toggle')?.textContent).toContain('展开各项');

    page.root!.querySelector<HTMLButtonElement>('.record-items-toggle')!.click();
    await page.waitForChanges();
    expect(getContents().every(content => !content.hidden)).toBe(true);
  });
});
