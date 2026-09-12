import { h } from '@stencil/core';
import { newSpecPage } from '@stencil/core/testing';
import type { FormChangeDetail, FormSchema } from '../../types';
import { validateFormSchema } from '../../validation/schema';
import creatorSchemaJson from './creator-schema.json';
import { FormEasyCreator } from './form-easy-creator';
import type { FormEasyCreatorChangeDetail } from './types';

describe('设计器直接维护 FormSchema', () => {
  it('设计器自身的动态表单 Schema 符合完整结构约束', () => {
    const validation = validateFormSchema(creatorSchemaJson);

    expect(validation.valid).toBe(true);
    expect(validation.issues).toEqual([]);
  });

  it('直接载入外部 Schema，不再创建中间草稿对象', async () => {
    const schema: FormSchema = {
      key: 'directCreatorValue',
      name: '直接编辑 Schema',
      definitions: {
        text: {
          category: 'basic',
          dataType: 'string'
        }
      },
      fields: [
        {
          $ref: 'text',
          key: 'title',
          name: '标题',
          defaultValue: null
        }
      ]
    };
    const page = await newSpecPage({
      components: [FormEasyCreator],
      template: () => <form-easy-creator value={schema} />
    });
    const creator = page.root as HTMLElement & {
      /** 获取设计器当前直接维护的 Schema。 */
      getSchema(): Promise<FormSchema>;
    };

    expect(await creator.getSchema()).toBe(schema);
  });

  it('将内部动态表单输出直接作为 Schema 和变更事件数据', async () => {
    const initialSchema: FormSchema = {
      key: 'initialForm',
      name: '初始表单',
      fields: []
    };
    const changedSchema: FormSchema = {
      key: 'changedForm',
      name: '修改后的表单',
      fields: [
        {
          key: 'enabled',
          name: '启用状态',
          category: 'basic',
          dataType: 'boolean',
          defaultValue: false
        }
      ]
    };
    const page = await newSpecPage({
      components: [FormEasyCreator],
      template: () => <form-easy-creator value={initialSchema} />
    });
    const creator = page.root as HTMLElement & {
      /** 获取设计器当前直接维护的 Schema。 */
      getSchema(): Promise<FormSchema>;
    };
    let changeDetail: FormEasyCreatorChangeDetail | undefined;
    creator.addEventListener('schemaChange', event => {
      changeDetail = (
        event as CustomEvent<FormEasyCreatorChangeDetail>
      ).detail;
    });
    const formChangeDetail: FormChangeDetail = {
      fieldId: 'formEasyCreator.name',
      value: changedSchema.name,
      formData: changedSchema as unknown as Record<string, unknown>
    };

    creator.querySelector('form-easy')!.dispatchEvent(new CustomEvent(
      'formChange',
      {
        detail: formChangeDetail,
        bubbles: true,
        composed: true
      }
    ));
    await page.waitForChanges();

    expect(await creator.getSchema()).toBe(changedSchema);
    expect(changeDetail?.schema).toBe(changedSchema);
    expect(changeDetail?.validation.valid).toBe(true);
  });
});
