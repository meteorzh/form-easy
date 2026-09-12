import {
  assignNamedFieldValue,
  createFormOutputData
} from './form-field-output';
import { FormValueStore, synchronizeFormFieldValue } from './managers/form-value-store';
import type { FormField, NamedFormField } from './types';
import { validateFormSchema } from './validation/schema';

describe('命名字段输出省略策略', () => {
  it('省略 null，但保留 false、0、空字符串、空数组和空对象', () => {
    const field: FormField = {
      key: 'value',
      name: '值',
      category: 'basic',
      dataType: 'string',
      omitNull: true
    };
    const output: Record<string, unknown> = { value: '旧值' };

    assignNamedFieldValue(output, field, null);
    expect(output).toEqual({});

    [false, 0, '', [], {}].forEach(value => {
      assignNamedFieldValue(output, field, value);
      expect(output.value).toBe(value);
    });
  });

  it('递归省略对象、数组对象元素和 record value 内的命名字段', () => {
    const optionalChild: NamedFormField = {
      key: 'optional',
      name: '可选值',
      category: 'basic',
      dataType: 'string',
      omitNull: true
    };
    const objectField: FormField = {
      key: 'objectValue',
      name: '对象',
      category: 'object',
      fields: [optionalChild]
    };
    const output: Record<string, unknown> = {};

    assignNamedFieldValue(output, objectField, { optional: null });
    expect(output).toEqual({ objectValue: {} });

    const arrayField: FormField = {
      key: 'items',
      name: '数组',
      category: 'array',
      element: {
        category: 'object',
        fields: [optionalChild]
      }
    };
    assignNamedFieldValue(output, arrayField, [{ optional: null }]);
    expect(output.items).toEqual([{}]);

    const recordField: FormField = {
      key: 'properties',
      name: 'Record',
      category: 'record',
      kvDef: {
        key: {},
        value: {
          category: 'object',
          fields: [optionalChild]
        }
      }
    };
    assignNamedFieldValue(output, recordField, {
      first: { optional: null }
    });
    expect(output.properties).toEqual({ first: {} });
  });

  it('只影响输出对象，不删除 FormValueStore 中的 null', () => {
    const field: FormField = {
      key: 'optional',
      name: '可选值',
      category: 'basic',
      dataType: 'string',
      omitNull: true
    };
    const store = new FormValueStore();
    const output: Record<string, unknown> = {};

    synchronizeFormFieldValue(store, field, 'form.optional', null);
    assignNamedFieldValue(output, field, null);

    expect(store.hasValue('form.optional')).toBe(true);
    expect(store.getValue('form.optional')).toBeNull();
    expect(output).toEqual({});
  });

  it('字段隐藏时省略输出，并在重新显示后恢复原始值', () => {
    const field: FormField = {
      key: 'conditional',
      name: '条件字段',
      category: 'basic',
      dataType: 'string',
      omitWhenHidden: true
    };
    const formData = { conditional: '保留的值' };
    let visible = false;
    const createOutput = () => createFormOutputData(
      [field],
      formData,
      'form',
      {
        isFieldVisible: () => visible
      }
    );

    expect(createOutput()).toEqual({});
    expect(formData).toEqual({ conditional: '保留的值' });

    visible = true;
    expect(createOutput()).toEqual({ conditional: '保留的值' });
  });

  it('根据 optional 字段的独立存在状态输出或省略 null 值', () => {
    const field: FormField = {
      key: 'nullable',
      name: '可空配置',
      category: 'basic',
      dataType: 'string',
      optional: true
    };
    const formData = { nullable: null };
    let present = false;
    const createOutput = () => createFormOutputData(
      [field],
      formData,
      'form',
      {
        isFieldPresent: () => present
      }
    );

    expect(createOutput()).toEqual({});

    present = true;
    expect(createOutput()).toEqual({ nullable: null });
  });

  it('仅允许拥有 key 的命名字段配置输出省略策略', () => {
    const namedResult = validateFormSchema({
      key: 'form',
      name: '表单',
      fields: [
        {
          key: 'optional',
          name: '可选值',
          category: 'basic',
          dataType: 'string',
          omitNull: true,
          omitWhenHidden: true,
          optional: true
        }
      ]
    });
    const anonymousResult = validateFormSchema({
      key: 'form',
      name: '表单',
      fields: [
        {
          key: 'items',
          name: '数组',
          category: 'array',
          element: {
            category: 'basic',
            dataType: 'string',
            omitNull: true,
            omitWhenHidden: true,
            optional: true
          }
        }
      ]
    });

    expect(namedResult.valid).toBe(true);
    expect(anonymousResult.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'forbidden-property',
        path: '$.fields[0].element.omitNull'
      }),
      expect.objectContaining({
        code: 'forbidden-property',
        path: '$.fields[0].element.omitWhenHidden'
      }),
      expect.objectContaining({
        code: 'forbidden-property',
        path: '$.fields[0].element.optional'
      })
    ]));
  });
});
