import type { FormSchema } from '../../types';
import {
  createCreatorFormValue,
  mapCreatorValueToSchema
} from './creator-schema-mapper';

describe('设计器字段声明草稿', () => {
  /** 用于验证内联字段和引用字段往返转换的表单。 */
  const schema: FormSchema = {
    key: 'creatorDraft',
    name: '设计器草稿',
    definitions: {
      text: {
        category: 'basic',
        dataType: 'string'
      }
    },
    fields: [
      {
        key: 'inlineField',
        name: '内联字段',
        category: 'basic',
        dataType: 'number'
      },
      {
        $ref: 'text',
        key: 'referenceField',
        name: '引用字段',
        optional: false,
        hint: '引用覆盖提示'
      }
    ]
  };

  it('使用同级 $ref 区分内联字段和引用字段', () => {
    const draft = createCreatorFormValue(schema);
    const fields = draft.fields as Array<Record<string, unknown>>;

    expect(draft).toEqual(expect.objectContaining({
      key: schema.key,
      name: schema.name
    }));
    expect(draft).not.toHaveProperty('formKey');
    expect(draft).not.toHaveProperty('formName');
    expect(draft).not.toHaveProperty('schemaDefinitions');
    expect(draft).not.toHaveProperty('fieldDefinitions');
    expect(draft.definitions).toEqual({
      text: expect.objectContaining({
        category: 'basic',
        dataType: 'string'
      })
    });

    expect(fields[0]).toEqual(expect.objectContaining({
      $ref: null,
      category: 'basic',
      dataType: 'number'
    }));
    expect(fields[0]).not.toHaveProperty('mode');
    expect(fields[0]).not.toHaveProperty('definition');
    expect(fields[0]).not.toHaveProperty('required');
    expect(fields[0]).not.toHaveProperty('hint');

    expect(fields[1]).toEqual(expect.objectContaining({
      $ref: 'text',
      hint: '引用覆盖提示',
      optional: false
    }));
    expect(fields[1]).not.toHaveProperty('required');
    expect(fields[1]).not.toHaveProperty('mode');
    expect(fields[1]).not.toHaveProperty('referenceName');
    expect(fields[1]).not.toHaveProperty('requiredOverride');
    expect(Object.keys(fields[1]).some(key =>
      key.startsWith('referenceOverride_')
    )).toBe(false);
  });

  it('能够将同级 $ref 草稿映射回标准字段节点', () => {
    const draft = createCreatorFormValue(schema);
    const result = mapCreatorValueToSchema(draft);

    expect(result.issues).toEqual([]);
    expect(result.schema.definitions).toEqual(schema.definitions);
    expect(result.schema.fields).toEqual(schema.fields);
  });

  it('能够区分引用字段的继承和显式非必填状态', () => {
    const draft = createCreatorFormValue(schema);
    const fields = draft.fields as Array<Record<string, unknown>>;
    fields[1].required = false;

    const result = mapCreatorValueToSchema(draft);

    expect(result.schema.fields[1]).toEqual(expect.objectContaining({
      $ref: 'text',
      required: false
    }));
  });

  it('能够使用空数组明确覆盖引用定义中的集合属性', () => {
    const draft = createCreatorFormValue(schema);
    const fields = draft.fields as Array<Record<string, unknown>>;
    fields[1].rules = [];

    const result = mapCreatorValueToSchema(draft);

    expect(result.schema.fields[1]).toEqual(expect.objectContaining({
      $ref: 'text',
      rules: []
    }));
  });

  it('数组元素定义直接使用标准 element key', () => {
    const arraySchema: FormSchema = {
      key: 'arrayCreatorDraft',
      name: '数组设计器草稿',
      labelPosition: 'left',
      fields: [
        {
          key: 'items',
          name: '数组字段',
          category: 'array',
          element: {
            category: 'basic',
            dataType: 'string'
          }
        }
      ]
    };
    const draft = createCreatorFormValue(arraySchema);
    const fields = draft.fields as Array<Record<string, unknown>>;

    expect(fields[0]).toHaveProperty('element');
    expect(fields[0]).not.toHaveProperty('elementDefinition');
    expect(mapCreatorValueToSchema(draft).schema).toEqual(arraySchema);
  });

  it('JSON 编辑字段在设计器草稿中直接保存解析后的真实值', () => {
    const valueSchema: FormSchema = {
      key: 'directJsonValueForm',
      name: 'JSON 真实值表单',
      labelPosition: 'left',
      fields: [
        {
          key: 'selectValue',
          name: '选择值',
          category: 'basic',
          dataType: 'string',
          defaultValue: 'enabled',
          componentData: [
            { label: '启用', value: 'enabled' }
          ],
          componentProperties: {
            clearable: true
          },
          rules: [
            {
              type: 'enum',
              value: ['enabled', 'disabled']
            }
          ]
        }
      ]
    };
    const draft = createCreatorFormValue(valueSchema);
    const field = (draft.fields as Array<Record<string, unknown>>)[0];
    const rules = field.rules as Array<Record<string, unknown>>;

    expect(field.defaultValue).toBe('enabled');
    expect(field.componentData).toEqual([
      { label: '启用', value: 'enabled' }
    ]);
    expect(field.componentProperties).toEqual({ clearable: true });
    expect(rules[0].value).toEqual(['enabled', 'disabled']);
    expect(field).not.toHaveProperty('defaultValueJson');
    expect(field).not.toHaveProperty('componentDataJson');
    expect(field).not.toHaveProperty('componentPropertiesJson');
    expect(rules[0]).not.toHaveProperty('valueJson');
    expect(mapCreatorValueToSchema(draft).schema).toEqual(valueSchema);
  });
});
