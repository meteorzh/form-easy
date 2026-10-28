import { h } from '@stencil/core';
import { newSpecPage } from '@stencil/core/testing';
import { FormEasy } from './components/form-easy/form-easy';
import { FormEasyField } from './components/form-easy-field/form-easy-field';
import { FormEasyCreator } from './components/creator/form-easy-creator';
import type { BasicFieldRenderer } from './renderers/basic-field-renderer';
import type { FormLoadingDetail, FormSchema } from './types';

/** loading 测试不需要挂载真实输入控件。 */
const noopRenderer: BasicFieldRenderer = {
  render: () => undefined,
  unmount: () => undefined
};

/** 创建一个只含单个基础字段的 schema。 */
function createSchema(key: string, fieldKey: string): FormSchema {
  return {
    key,
    name: key.toUpperCase(),
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

/** 推进若干个宏任务与渲染周期，等待异步重载和字段树稳定全部完成。 */
async function flush(page: {
  waitForChanges(): Promise<unknown>;
}): Promise<void> {
  for (let i = 0; i < 40; i++) {
    await new Promise(resolve => { setTimeout(resolve, 0); });
    await page.waitForChanges();
  }
}

/** loading 事件记录：formLoading 记为 true，formReady 记为 false。 */
type LoadingEventRecord = FormLoadingDetail & { loading: boolean };

/** 按发生顺序收集表单上收到的 formLoading 和 formReady 事件。 */
function captureLoadingEvents(element: Element): LoadingEventRecord[] {
  const events: LoadingEventRecord[] = [];
  element.addEventListener('formLoading', event => {
    events.push({ ...(event as CustomEvent<FormLoadingDetail>).detail, loading: true });
  });
  element.addEventListener('formReady', event => {
    events.push({ ...(event as CustomEvent<FormLoadingDetail>).detail, loading: false });
  });
  return events;
}

describe('表单 loading 蒙层竞态', () => {
  it('schema 变化导致加载时，加载完成后发出 formReady', async () => {
    const page = await newSpecPage({
      components: [FormEasy, FormEasyField],
      template: () => (
        <form-easy
          schema={createSchema('readyA', 'x')}
          basicFieldRenderer={noopRenderer}
        />
      )
    });
    await page.waitForChanges();
    // 首次挂载同样会进入加载状态，等它结束后再开始修改。
    await flush(page);
    const events = captureLoadingEvents(page.root!);
    const ready: string[] = [];
    page.root!.addEventListener('formReady', event => {
      ready.push((event as CustomEvent<{ formKey: string }>).detail.formKey);
    });

    (page.root as any).schema = createSchema('readyB', 'y');
    await flush(page);

    const form = page.rootInstance as unknown as {
      formData: Record<string, unknown>;
    };
    expect(form.formData.y).toBeNull();
    expect(ready).toEqual(['readyB']);
    expect(events[events.length - 1].loading).toBe(false);
  });

  it('formReady 监听器里立即设置 value 不会丢失重载、蒙层能正常收起', async () => {
    const page = await newSpecPage({
      components: [FormEasy, FormEasyField],
      template: () => (
        <form-easy
          schema={createSchema('chainA', 'x')}
          basicFieldRenderer={noopRenderer}
        />
      )
    });
    await page.waitForChanges();
    // 首次挂载同样会进入加载状态，等它结束后再开始修改。
    await flush(page);
    const events = captureLoadingEvents(page.root!);
    // 模拟 Vue 包装层：结构就绪后同步写入已保存的值。
    page.root!.addEventListener('formReady', () => {
      (page.root as any).value = { y: 'saved' };
    });

    (page.root as any).schema = createSchema('chainB', 'y');
    await flush(page);

    const form = page.rootInstance as unknown as {
      formData: Record<string, unknown>;
      schemaLoading: boolean;
    };
    expect(form.formData.y).toBe('saved');
    expect(form.schemaLoading).toBe(false);
    expect(events.map(event => event.loading)).toEqual([true, false, true, false]);
  });

  it('value 加载结束后在 formReady 里设置 value 属于合法修改，会正常应用', async () => {
    const page = await newSpecPage({
      components: [FormEasy, FormEasyField],
      template: () => (
        <form-easy
          schema={createSchema('endA', 'x')}
          basicFieldRenderer={noopRenderer}
        />
      )
    });
    await page.waitForChanges();
    // 首次挂载同样会进入加载状态，等它结束后再开始修改。
    await flush(page);
    const errors: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => errors.push(String(args[0]));
    let pushed = false;
    page.root!.addEventListener('formReady', () => {
      if (pushed) return;
      pushed = true;
      (page.root as any).value = { x: 'after-end' };
    });

    (page.root as any).value = { x: 'first' };
    await flush(page);
    console.error = originalError;

    const form = page.rootInstance as unknown as {
      formData: Record<string, unknown>;
      schemaLoading: boolean;
    };
    expect(errors).toEqual([]);
    expect(form.formData.x).toBe('after-end');
    expect(form.schemaLoading).toBe(false);
  });

  it('设计器 formReady 监听器里立即设置 value 不会丢失载入', async () => {
    const page = await newSpecPage({
      components: [FormEasyCreator],
      template: () => <form-easy-creator value={createSchema('eA', 'x')} />
    });
    await page.waitForChanges();
    // 首次挂载同样会进入加载状态，等它结束后再开始修改。
    await flush(page);
    let pushed = false;
    page.root!.addEventListener('formReady', () => {
      if (pushed) return;
      pushed = true;
      (page.root as any).value = createSchema('eC', 'z');
    });

    (page.root as any).value = createSchema('eB', 'y');
    await flush(page);

    const creator = page.root as HTMLElement & {
      getSchema(): Promise<FormSchema>;
    };
    expect((await creator.getSchema()).key).toBe('eC');
    expect(page.root!.querySelector('.creator-loading')).toBeNull();
  });

  it('value 变化导致加载时，同样成对发出 formLoading 和 formReady', async () => {
    const page = await newSpecPage({
      components: [FormEasy, FormEasyField],
      template: () => (
        <form-easy
          schema={createSchema('valueOnly', 'x')}
          basicFieldRenderer={noopRenderer}
        />
      )
    });
    await page.waitForChanges();
    // 首次挂载同样会进入加载状态，等它结束后再开始修改。
    await flush(page);
    const events = captureLoadingEvents(page.root!);
    const ready: string[] = [];
    page.root!.addEventListener('formReady', event => {
      ready.push((event as CustomEvent<{ formKey: string }>).detail.formKey);
    });

    (page.root as any).value = { x: 'vx' };
    await flush(page);

    expect(ready).toEqual(['valueOnly']);
    expect(events.map(event => event.loading)).toEqual([true, false]);
  });

  it('loading 期间修改 schema 会记录错误并忽略该次修改', async () => {
    const page = await newSpecPage({
      components: [FormEasy, FormEasyField],
      template: () => (
        <form-easy
          schema={createSchema('guardA', 'x')}
          basicFieldRenderer={noopRenderer}
        />
      )
    });
    await page.waitForChanges();
    // 首次挂载同样会进入加载状态，等它结束后再开始修改。
    await flush(page);
    const events = captureLoadingEvents(page.root!);
    const errors: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => errors.push(String(args[0]));

    (page.root as any).schema = createSchema('guardB', 'y');
    await new Promise(resolve => { setTimeout(resolve, 0); });
    // 加载期间再次修改 schema，必须报错并且不被应用。
    (page.root as any).schema = createSchema('guardC', 'z');
    await flush(page);
    console.error = originalError;

    const form = page.rootInstance as unknown as {
      schema: { key: string };
    };
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('正在加载中');
    expect(form.schema.key).toBe('guardB');
    expect(events[events.length - 1].loading).toBe(false);
  });

  it('loading 期间修改 value 会记录错误并忽略该次修改', async () => {
    const page = await newSpecPage({
      components: [FormEasy, FormEasyField],
      template: () => (
        <form-easy
          schema={createSchema('guardValue', 'x')}
          basicFieldRenderer={noopRenderer}
        />
      )
    });
    await page.waitForChanges();
    // 首次挂载同样会进入加载状态，等它结束后再开始修改。
    await flush(page);
    const errors: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => errors.push(String(args[0]));

    (page.root as any).value = { x: 'v1' };
    await new Promise(resolve => { setTimeout(resolve, 0); });
    (page.root as any).value = { x: 'v2' };
    await flush(page);
    console.error = originalError;

    const form = page.rootInstance as unknown as {
      formData: Record<string, unknown>;
    };
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('正在加载中');
    expect(form.formData.x).toBe('v1');
  });

  it('设计器载入完成后发出 formReady', async () => {
    const page = await newSpecPage({
      components: [FormEasyCreator],
      template: () => <form-easy-creator value={createSchema('cA', 'x')} />
    });
    await page.waitForChanges();
    // 首次挂载同样会进入加载状态，等它结束后再开始修改。
    await flush(page);
    const events = captureLoadingEvents(page.root!);
    const ready: string[] = [];
    page.root!.addEventListener('formReady', event => {
      ready.push((event as CustomEvent<{ formKey: string }>).detail.formKey);
    });

    (page.root as any).value = createSchema('cB', 'y');
    await flush(page);

    const creator = page.root as HTMLElement & {
      getSchema(): Promise<FormSchema>;
    };
    expect((await creator.getSchema()).key).toBe('cB');
    expect(ready).toEqual(['cB']);
    expect(events[events.length - 1].loading).toBe(false);
    expect(page.root!.querySelector('.creator-loading')).toBeNull();
  });

  it('设计器加载期间修改 value 会记录错误', async () => {
    const page = await newSpecPage({
      components: [FormEasyCreator],
      template: () => <form-easy-creator value={createSchema('dA', 'x')} />
    });
    await page.waitForChanges();
    // 首次挂载同样会进入加载状态，等它结束后再开始修改。
    await flush(page);
    const errors: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => errors.push(String(args[0]));

    (page.root as any).value = createSchema('dB', 'y');
    await new Promise(resolve => { setTimeout(resolve, 0); });
    (page.root as any).value = createSchema('dC', 'z');
    await flush(page);
    console.error = originalError;

    const creator = page.root as HTMLElement & {
      getSchema(): Promise<FormSchema>;
    };
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('正在载入');
    expect((await creator.getSchema()).key).toBe('dB');
  });
});
