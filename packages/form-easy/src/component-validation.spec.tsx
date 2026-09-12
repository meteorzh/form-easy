import { h } from '@stencil/core';
import { newSpecPage } from '@stencil/core/testing';
import { FormEasyCreatorJsonEditor } from './components/creator/form-easy-creator-json-editor';
import { FormEasyField } from './components/form-easy-field/form-easy-field';
import { FormEasy } from './components/form-easy/form-easy';
import type {
  BasicFieldRenderContext,
  BasicFieldRenderer
} from './renderers/basic-field-renderer';
import type {
  ComponentValidationResult,
  FormSchema
} from './types';

describe('基础字段组件内部校验', () => {
  it('能够合并到字段与表单主动拉取的校验结果中', async () => {
    let renderContext: BasicFieldRenderContext | undefined;
    const renderer: BasicFieldRenderer = {
      /** 保存字段提供的运行时回调，模拟自定义组件上报校验结果。 */
      render: (_host, context) => {
        renderContext = context;
      },
      /** 测试渲染器没有需要释放的视图。 */
      unmount: () => undefined
    };
    const schema: FormSchema = {
      key: 'componentValidationForm',
      name: '组件校验测试表单',
      fields: [
        {
          key: 'content',
          name: '组件内部状态',
          category: 'basic',
          dataType: 'string'
        }
      ]
    };
    const page = await newSpecPage({
      components: [FormEasy, FormEasyField],
      template: () => (
        <form-easy schema={schema} basicFieldRenderer={renderer} />
      )
    });
    await page.waitForChanges();

    const form = page.root as HTMLElement & {
      /** 主动校验表单中全部字段。 */
      validate(): Promise<boolean>;
    };
    const field = form.querySelector('form-easy-field') as HTMLElement & {
      /** 主动校验当前字段。 */
      validate(): Promise<boolean>;
    };
    renderContext!.onValidationChange({
      valid: false,
      message: '组件内容格式不正确。'
    });
    await page.waitForChanges();

    expect(await field.validate()).toBe(false);
    expect(await form.validate()).toBe(false);
    expect(field.querySelector('.validation-error')?.textContent)
      .toContain('组件内容格式不正确。');

    renderContext!.onValidationChange({ valid: true });
    await page.waitForChanges();
    expect(await form.validate()).toBe(true);
  });
});

describe('设计器 JSON 编辑器', () => {
  it('合法 JSON 直接输出解析值，非法中间态只上报校验错误', async () => {
    const page = await newSpecPage({
      components: [FormEasyCreatorJsonEditor],
      template: () => (
        <form-easy-creator-json-editor value={{ original: true }} />
      )
    });
    const values: unknown[] = [];
    const validationResults: ComponentValidationResult[] = [];
    page.root!.addEventListener('valueChange', event => {
      values.push((event as CustomEvent<unknown>).detail);
    });
    page.root!.addEventListener('componentValidationChange', event => {
      validationResults.push(
        (event as CustomEvent<ComponentValidationResult>).detail
      );
    });
    const textarea = page.root!.querySelector('textarea')!;

    textarea.value = '{"name":';
    textarea.dispatchEvent(new Event('input'));
    await page.waitForChanges();
    expect(values).toEqual([]);
    expect(validationResults.at(-1)).toEqual(expect.objectContaining({
      valid: false
    }));
    expect(textarea.getAttribute('aria-invalid')).toBe('true');

    textarea.value = '{"name":"form-easy"}';
    textarea.dispatchEvent(new Event('input'));
    await page.waitForChanges();
    expect(values.at(-1)).toEqual({ name: 'form-easy' });
    expect(validationResults.at(-1)).toEqual({ valid: true });
    expect(textarea.getAttribute('aria-invalid')).toBe('false');
  });

  it('文本模式保留 JavaScript resolver 的原始字符串输出', async () => {
    const page = await newSpecPage({
      components: [FormEasyCreatorJsonEditor],
      template: () => (
        <form-easy-creator-json-editor mode="text" value="" />
      )
    });
    let changedValue: unknown;
    page.root!.addEventListener('valueChange', event => {
      changedValue = (event as CustomEvent<unknown>).detail;
    });
    const textarea = page.root!.querySelector('textarea')!;
    const resolver = "return sourceFieldValue === 'basic';";

    textarea.value = resolver;
    textarea.dispatchEvent(new Event('input'));
    await page.waitForChanges();

    expect(changedValue).toBe(resolver);
    expect(textarea.getAttribute('aria-invalid')).toBe('false');
  });
});
