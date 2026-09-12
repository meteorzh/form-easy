import type {
  AnonymousFormField,
  AnonymousFormFieldReference,
  FormFieldDefinition,
  FormSchema,
  NamedFormField,
  NamedFormFieldReference
} from './types';

describe('字段声明类型', () => {
  it('允许各字段分类出现在正确的位置', () => {
    const reusableDefinition: FormFieldDefinition = {
      category: 'basic',
      dataType: 'string'
    };
    const anonymousElement: AnonymousFormField = {
      category: 'object',
      fields: [
        {
          key: 'title',
          name: '标题',
          category: 'basic',
          dataType: 'string'
        }
      ]
    };
    const namedField: NamedFormField = {
      key: 'items',
      name: '项目列表',
      category: 'array',
      element: anonymousElement
    };
    const recordField: NamedFormField = {
      key: 'properties',
      name: '动态属性',
      category: 'record',
      kvDef: {
        key: {},
        value: {
          category: 'basic',
          dataType: 'number'
        }
      }
    };
    const namedReference: NamedFormFieldReference = {
      $ref: 'reusableText',
      key: 'summary',
      name: '摘要'
    };
    const schema: FormSchema = {
      key: 'typeExample',
      name: '类型示例',
      definitions: {
        reusableText: reusableDefinition
      },
      fields: [namedField, recordField, namedReference]
    };

    expect(schema.fields).toHaveLength(3);
  });

  it('通过 TypeScript 阻止分类和位置不兼容的属性', () => {
    // @ts-expect-error 数组字段必须声明 element。
    const arrayWithoutElement: NamedFormField = {
      key: 'items',
      name: '项目列表',
      category: 'array'
    };

    const anonymousField: AnonymousFormField = {
      category: 'basic',
      dataType: 'string',
      // @ts-expect-error 匿名字段不允许声明 key。
      key: 'anonymous'
    };

    // @ts-expect-error 基础字段不允许声明对象子字段。
    const basicWithObjectFields: NamedFormField = {
      key: 'title',
      name: '标题',
      category: 'basic',
      dataType: 'string',
      fields: []
    };

    const anonymousReference: AnonymousFormFieldReference = {
      $ref: 'reusableText',
      // @ts-expect-error 匿名引用不允许声明命名字段的输出策略。
      omitNull: true
    };

    expect(arrayWithoutElement).toBeDefined();
    expect(anonymousField).toBeDefined();
    expect(basicWithObjectFields).toBeDefined();
    expect(anonymousReference).toBeDefined();
  });
});
