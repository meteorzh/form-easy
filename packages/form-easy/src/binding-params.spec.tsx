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

/** 创建使用两个命名参数控制目标可见性的测试表单。 */
function createBindingSchema(
  resolver?: string
): FormSchema {
  return {
    key: 'bindingParamsForm',
    name: '绑定参数测试表单',
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
            target: 'visible',
            params: {
              first: './firstSource',
              second: './secondSource'
            },
            ...(resolver ? { resolver } : {})
          }
        ]
      }
    ]
  };
}

describe('字段绑定命名参数', () => {
  it('允许 resolver 使用多个命名源参数表达完整条件', () => {
    const result = validateFormSchema(createBindingSchema(
      'return Boolean(first) || Boolean(second);'
    ));

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('多参数绑定缺少 resolver 时报告配置错误', () => {
    const result = validateFormSchema(createBindingSchema());

    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'missing-property',
        path: '$.fields[2].binds[0].resolver'
      })
    ]));
  });

  it('禁止同一个字段使用多个 bind 控制相同 target', () => {
    const schema = createBindingSchema('return first && second;');
    schema.fields[2].binds!.push({
      target: 'visible',
      params: {
        sourceFieldValue: './firstSource'
      }
    });
    const result = validateFormSchema(schema);

    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'duplicate-binding' })
    ]));
  });

  it('任一命名参数满足 resolver 时显示目标字段', async () => {
    const page = await newSpecPage({
      components: [FormEasy, FormEasyField],
      template: () => (
        <form-easy
          schema={createBindingSchema(
            'return Boolean(first) || Boolean(second);'
          )}
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

  it('允许 value resolver 根据多个参数计算字段值', async () => {
    const schema: FormSchema = {
      key: 'computedValueForm',
      name: '计算值绑定表单',
      fields: [
        {
          key: 'firstName',
          name: '名',
          category: 'basic',
          dataType: 'string',
          defaultValue: 'Form'
        },
        {
          key: 'lastName',
          name: '姓',
          category: 'basic',
          dataType: 'string',
          defaultValue: 'Easy'
        },
        {
          key: 'fullName',
          name: '完整名称',
          category: 'basic',
          dataType: 'string',
          binds: [
            {
              target: 'value',
              params: {
                firstName: './firstName',
                lastName: './lastName'
              },
              resolver: 'return `${firstName} ${lastName}`;'
            }
          ]
        }
      ]
    };
    const page = await newSpecPage({
      components: [FormEasy, FormEasyField],
      template: () => (
        <form-easy
          schema={schema}
          eventCenter={new EventCenter()}
          basicFieldRenderer={createTestRenderer()}
        />
      )
    });
    await page.waitForChanges();
    const fields = Array.from(
      page.root!.querySelectorAll('form-easy-field')
    ) as Array<HTMLElement & {
      /** 当前由根表单传入的字段值。 */
      value: unknown;
      /** 执行字段支持的标准操作命令。 */
      applyHandle(handle: 'change', value: unknown): Promise<void>;
    }>;

    expect(fields[2].value).toBe('Form Easy');

    await fields[0].applyHandle('change', 'Dynamic');
    await page.waitForChanges();
    expect(fields[2].value).toBe('Dynamic Easy');
  });
});
