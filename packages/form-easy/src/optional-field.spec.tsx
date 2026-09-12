import { h } from '@stencil/core';
import { newSpecPage } from '@stencil/core/testing';
import { FormEasy } from './components/form-easy/form-easy';
import { FormEasyField } from './components/form-easy-field/form-easy-field';
import type { BasicFieldRenderer } from './renderers/basic-field-renderer';
import type { FormChangeDetail, FormSchema } from './types';

/** 创建不挂载实际输入控件的测试渲染器。 */
function createTestRenderer(): BasicFieldRenderer {
  return {
    /** optional 测试只关心字段外层状态。 */
    render: () => undefined,
    /** 测试渲染器没有需要释放的框架实例。 */
    unmount: () => undefined
  };
}

describe('optional 字段输出存在状态', () => {
  it('默认不输出字段，并可以从 label 区域启用 null 值输出', async () => {
    const schema: FormSchema = {
      key: 'optionalForm',
      name: '可选输出表单',
      fields: [
        {
          key: 'nullable',
          name: '可空字段',
          category: 'basic',
          dataType: 'string',
          optional: true
        }
      ]
    };
    const page = await newSpecPage({
      components: [FormEasy, FormEasyField],
      template: () => (
        <form-easy schema={schema} basicFieldRenderer={createTestRenderer()} />
      )
    });
    await page.waitForChanges();

    const changes: FormChangeDetail[] = [];
    page.root!.addEventListener('formChange', event => {
      changes.push((event as CustomEvent<FormChangeDetail>).detail);
    });
    const field = page.root!.querySelector('form-easy-field')!;
    const toggle = field.querySelector<HTMLButtonElement>('.field-presence-toggle')!;

    expect(field.querySelector('.editor')).toBeNull();
    expect(field.querySelector('.field-label-text')?.classList.contains(
      'field-label-text'
    )).toBe(true);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    toggle.click();
    await page.waitForChanges();

    expect(field.querySelector('.editor')).not.toBeNull();
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(changes.at(-1)?.formData).toEqual({ nullable: null });
  });

  it('预设对象中明确存在的 null 属性保持已设置状态', async () => {
    const schema: FormSchema = {
      key: 'optionalPresetForm',
      name: '可选输出预设值表单',
      fields: [
        {
          key: 'nullable',
          name: '可空字段',
          category: 'basic',
          dataType: 'string',
          optional: true
        }
      ]
    };
    const page = await newSpecPage({
      components: [FormEasy, FormEasyField],
      template: () => (
        <form-easy
          schema={schema}
          value={{ nullable: null }}
          basicFieldRenderer={createTestRenderer()}
        />
      )
    });
    await page.waitForChanges();

    const field = page.root!.querySelector('form-easy-field')!;
    const toggle = field.querySelector('.field-presence-toggle')!;
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(field.querySelector('.editor')).not.toBeNull();
  });
});
