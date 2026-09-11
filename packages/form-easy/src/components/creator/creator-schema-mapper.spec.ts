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
        hint: '引用覆盖提示'
      }
    ]
  };

  it('使用同级 $ref 区分内联字段和引用字段', () => {
    const draft = createCreatorFormValue(schema);
    const fields = draft.fieldDefinitions as Array<Record<string, unknown>>;

    expect(draft.schemaDefinitions).toEqual({
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

    expect(fields[1]).toEqual(expect.objectContaining({
      $ref: 'text',
      referenceOverride_hint: '引用覆盖提示'
    }));
    expect(fields[1]).not.toHaveProperty('mode');
    expect(fields[1]).not.toHaveProperty('referenceName');
  });

  it('能够将同级 $ref 草稿映射回标准字段节点', () => {
    const draft = createCreatorFormValue(schema);
    const result = mapCreatorValueToSchema(draft);

    expect(result.issues).toEqual([]);
    expect(result.schema.definitions).toEqual(schema.definitions);
    expect(result.schema.fields).toEqual(schema.fields);
  });
});
