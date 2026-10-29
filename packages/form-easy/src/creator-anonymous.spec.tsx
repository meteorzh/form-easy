import { h } from '@stencil/core';
import { newSpecPage } from '@stencil/core/testing';
import { FormEasyCreator } from './components/creator/form-easy-creator';
import type { FormEasyCreatorChangeDetail } from './components/creator/types';
import type { FormSchema } from './types';

/** 创建一个只含单个基础字段的 schema。 */
function createSchema(key: string, fieldKey: string, name?: string): FormSchema {
  return {
    key,
    ...(name === undefined ? {} : { name }),
    fields: [
      {
        key: fieldKey,
        name: `${fieldKey}字段`,
        category: 'basic',
        dataType: 'string'
      }
    ]
  };
}

/** 推进若干个宏任务与渲染周期，等待异步载入完成。 */
async function flush(page: {
  waitForChanges(): Promise<unknown>;
}): Promise<void> {
  for (let i = 0; i < 12; i++) {
    await new Promise(resolve => { setTimeout(resolve, 0); });
    await page.waitForChanges();
  }
}

type CreatorElement = HTMLElement & {
  value?: FormSchema;
  anonymous?: boolean;
  getSchema(): Promise<FormSchema>;
  validate(): Promise<boolean>;
};

type InnerFormElement = HTMLElement & { schema: FormSchema };

/** 获取设计器内部的配置表单元素。 */
function getEditor(root: Element): InnerFormElement | null {
  return root.querySelector('.creator-editor form-easy') as InnerFormElement | null;
}

/** 获取配置表单当前包含的顶层字段 key。 */
function getEditorFieldKeys(root: Element): string[] {
  return getEditor(root)!.schema.fields.map(field => field.key as string);
}

/** 模拟配置表单输出一次编辑结果。 */
function emitEditorChange(root: Element, formData: Record<string, unknown>): void {
  getEditor(root)!.dispatchEvent(new CustomEvent('formChange', {
    detail: { fieldId: 'formEasyCreator.fields', value: formData.fields, formData }
  }));
}

/** 收集 console.error 输出。 */
function captureErrors(): { errors: string[]; restore(): void } {
  const errors: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => errors.push(String(args[0]));
  return { errors, restore: () => { console.error = originalError; } };
}

describe('设计器匿名模式', () => {
  it('不显示 key 和 name 的输入，输出时合并传入的 key 并原样保留 name', async () => {
    const page = await newSpecPage({
      components: [FormEasyCreator],
      template: () => (
        <form-easy-creator anonymous value={createSchema('anonA', 'x', '原名称')} />
      )
    });
    await flush(page);
    const changes: FormEasyCreatorChangeDetail[] = [];
    page.root!.addEventListener('schemaChange', event => {
      changes.push((event as CustomEvent<FormEasyCreatorChangeDetail>).detail);
    });

    expect(getEditorFieldKeys(page.root!)).not.toContain('key');
    expect(getEditorFieldKeys(page.root!)).not.toContain('name');

    emitEditorChange(page.root!, { labelPosition: 'top', fields: [] });

    expect(changes).toHaveLength(1);
    expect(changes[0].schema).toEqual({
      key: 'anonA',
      name: '原名称',
      labelPosition: 'top',
      fields: []
    });
  });

  it('传入的 value 没有 name 时，输出也不带 name', async () => {
    const page = await newSpecPage({
      components: [FormEasyCreator],
      template: () => <form-easy-creator anonymous value={createSchema('anonB', 'x')} />
    });
    await flush(page);

    emitEditorChange(page.root!, { fields: [] });

    expect(await (page.root as CreatorElement).getSchema()).toEqual({ key: 'anonB', fields: [] });
  });

  it('传入的 value 没有 key 时生成默认 key，未传入 value 时从空表单开始', async () => {
    const { errors, restore } = captureErrors();
    const page = await newSpecPage({
      components: [FormEasyCreator],
      template: () => <form-easy-creator anonymous />
    });
    await flush(page);
    const creator = page.root as CreatorElement;

    const empty = await creator.getSchema();
    expect(empty.key).toMatch(/^anonymous_[a-z0-9]{8}$/);
    expect(empty.fields).toEqual([]);
    expect(empty.name).toBeUndefined();

    creator.value = { name: '无 key 表单', fields: [] } as unknown as FormSchema;
    await flush(page);
    restore();

    const loaded = await creator.getSchema();
    expect(errors).toEqual([]);
    expect(loaded.key).toMatch(/^anonymous_[a-z0-9]{8}$/);
    expect(loaded.name).toBe('无 key 表单');

    // 生成的 key 会随编辑结果一起输出。
    emitEditorChange(page.root!, { fields: [] });
    expect((await creator.getSchema()).key).toBe(loaded.key);
  });

  it('不再要求至少配置一个字段，definitions 和 name 未传入时不输出', async () => {
    const page = await newSpecPage({
      components: [FormEasyCreator],
      template: () => <form-easy-creator value={{ key: 'emptyForm', fields: [] }} />
    });
    await flush(page);
    const fieldsField = getEditor(page.root!)!.schema.fields
      .find(field => field.key === 'fields')!;

    expect(fieldsField.required).toBeFalsy();
    expect(fieldsField.rules ?? []).toEqual([]);
    // 传入的 schema 没有 definitions 时不输出 definitions: null。
    const definitionsField = getEditor(page.root!)!.schema.fields
      .find(field => field.key === 'definitions')!;
    expect(definitionsField.optional).toBe(true);
    // 表单名称选填：不是必填项，也不需要单独启用。
    const nameField = getEditor(page.root!)!.schema.fields
      .find(field => field.key === 'name')!;
    expect(nameField.required).toBeFalsy();
    expect(nameField.optional).toBeFalsy();
  });

  it('载入期间不能切换模式', async () => {
    const page = await newSpecPage({
      components: [FormEasyCreator],
      template: () => <form-easy-creator value={createSchema('modeA', 'x')} />
    });
    await flush(page);
    const creator = page.root as CreatorElement;
    const { errors, restore } = captureErrors();

    creator.value = createSchema('modeB', 'y');
    await new Promise(resolve => { setTimeout(resolve, 0); });
    creator.anonymous = true;
    await flush(page);
    restore();

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('不能切换匿名模式');
    expect(creator.anonymous).toBe(false);
    expect(getEditorFieldKeys(page.root!)).toContain('key');
  });

  it('切换模式只重建配置区，不重新载入，并保留当前编辑结果', async () => {
    const page = await newSpecPage({
      components: [FormEasyCreator],
      template: () => <form-easy-creator value={createSchema('switchA', 'x', '名称')} />
    });
    await flush(page);
    const creator = page.root as CreatorElement;
    const loadingEvents: string[] = [];
    page.root!.addEventListener('formLoading', () => loadingEvents.push('loading'));
    page.root!.addEventListener('formReady', () => loadingEvents.push('ready'));
    // 普通模式下用户把 key 改成了 edited。
    emitEditorChange(page.root!, { key: 'edited', name: '名称', fields: [] });

    creator.anonymous = true;
    await flush(page);

    expect(loadingEvents).toEqual([]);
    expect(getEditorFieldKeys(page.root!)).not.toContain('key');
    expect(await creator.getSchema()).toEqual({ key: 'edited', name: '名称', fields: [] });

    emitEditorChange(page.root!, { labelPosition: 'top', fields: [] });
    creator.anonymous = false;
    await flush(page);

    expect(loadingEvents).toEqual([]);
    expect(getEditorFieldKeys(page.root!)).toContain('key');
    expect(await creator.getSchema()).toEqual({
      key: 'edited',
      name: '名称',
      labelPosition: 'top',
      fields: []
    });
  });

  it('当前编辑结果没有 key 时切换到匿名模式会生成默认 key', async () => {
    const page = await newSpecPage({
      components: [FormEasyCreator],
      template: () => <form-easy-creator value={createSchema('noKey', 'x')} />
    });
    await flush(page);
    const creator = page.root as CreatorElement;
    emitEditorChange(page.root!, { key: '', fields: [] });

    creator.anonymous = true;
    await flush(page);

    expect(creator.anonymous).toBe(true);
    expect((await creator.getSchema()).key).toMatch(/^anonymous_[a-z0-9]{8}$/);
  });

  it('载入结果与传入 value 相同时不发出 schemaChange，生成了默认 key 时发出一次', async () => {
    const page = await newSpecPage({
      components: [FormEasyCreator],
      template: () => <form-easy-creator value={createSchema('same', 'x', '名称')} />
    });
    await flush(page);
    const changes: FormEasyCreatorChangeDetail[] = [];
    page.root!.addEventListener('schemaChange', event => {
      changes.push((event as CustomEvent<FormEasyCreatorChangeDetail>).detail);
    });

    // 配置区载入后上报的内容与传入值一致。
    emitEditorChange(page.root!, createSchema('same', 'x', '名称') as unknown as Record<string, unknown>);
    expect(changes).toEqual([]);

    const creator = page.root as CreatorElement;
    creator.anonymous = true;
    creator.value = { fields: [] } as unknown as FormSchema;
    await flush(page);
    emitEditorChange(page.root!, { fields: [] });

    expect(changes).toHaveLength(1);
    expect(changes[0].schema.key).toMatch(/^anonymous_[a-z0-9]{8}$/);
    // 再次上报相同内容不会重复发出。
    emitEditorChange(page.root!, { fields: [] });
    expect(changes).toHaveLength(1);
  });

  it('表单名称为 null 时由 omitNull 省略，空串和空白原样输出且校验通过', async () => {
    const page = await newSpecPage({
      components: [FormEasyCreator],
      template: () => <form-easy-creator value={createSchema('noName', 'x')} />
    });
    await flush(page);
    const creator = page.root as CreatorElement;
    const validation = async (): Promise<boolean> => (
      await (page.root as HTMLElement & {
        getSchemaValidationResult(): Promise<{ valid: boolean }>;
      }).getSchemaValidationResult()
    ).valid;

    // 配置区缺失 name 时补出的 null 由字段的 omitNull 输出策略省略。
    const nameField = getEditor(page.root!)!.schema.fields
      .find(field => field.key === 'name')!;
    expect(nameField.omitNull).toBe(true);

    for (const name of ['', '   ', '订单表单']) {
      emitEditorChange(page.root!, { key: 'noName', name, fields: [] });
      expect((await creator.getSchema()).name).toBe(name);
      expect(await validation()).toBe(true);
    }
  });
});
