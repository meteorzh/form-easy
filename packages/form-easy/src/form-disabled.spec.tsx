import { h } from '@stencil/core';
import { newSpecPage } from '@stencil/core/testing';
import { FormEasy } from './components/form-easy/form-easy';
import { FormEasyField } from './components/form-easy-field/form-easy-field';
import { FormEasyObject } from './components/form-easy-object/form-easy-object';
import { FormEasyArray } from './components/form-easy-array/form-easy-array';
import type { FormSchema } from './types';
import type { BasicFieldRenderer } from './renderers/basic-field-renderer';

describe('form disabled', () => {
  it('propagates dynamically and preserves field-local disabled state and values', async () => {
    const renderer: BasicFieldRenderer = {
      render: (host, context) => {
        let input = host.querySelector('input');
        if (!input) {
          input = document.createElement('input');
          host.appendChild(input);
        }
        input.disabled = context.disabled;
        input.value = String(context.value ?? '');
      },
      unmount: () => undefined
    };
    const schema: FormSchema = {
      key: 'disabledForm',
      fields: [
        { key: 'text', name: 'text', category: 'basic', dataType: 'string' },
        { key: 'optional', name: 'optional', category: 'basic', dataType: 'string', optional: true },
        { key: 'object', name: 'object', category: 'object', fields: [
          { key: 'nested', name: 'nested', category: 'basic', dataType: 'string' }
        ] },
        { key: 'list', name: 'list', category: 'array', element: {
          category: 'basic', dataType: 'string'
        } }
      ]
    };
    const page = await newSpecPage({
      components: [FormEasy, FormEasyField, FormEasyObject, FormEasyArray],
      template: () => <form-easy schema={schema} basicFieldRenderer={renderer} disabled value={{
        text: 'kept', object: { nested: 'nested' }, list: ['item']
      }} />
    });
    await page.waitForChanges();
    const root = page.root!;
    const inputs = () => Array.from(root.querySelectorAll('input'));
    expect(inputs().length).toBeGreaterThanOrEqual(3);
    expect(inputs().every(input => input.disabled)).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('.field-presence-toggle')!.hasAttribute('disabled')).toBe(true);
    expect(Array.from(root.querySelectorAll('form-easy-array button'))
      .filter(button => button.textContent?.includes('添加'))
      .every(button => button.hasAttribute('disabled'))).toBe(true);

    const field = root.querySelector('form-easy-field')!;
    await field.applyHandle('disable');
    root.disabled = false;
    await page.waitForChanges();
    expect(field.querySelector('input')!.disabled).toBe(true);
    expect(root.querySelector<HTMLInputElement>('form-easy-object input')!.disabled).toBe(false);
    expect(root.querySelector<HTMLButtonElement>('.field-presence-toggle')!.hasAttribute('disabled')).toBe(false);
    expect(field.querySelector('input')!.value).toBe('kept');

    await field.applyHandle('enable');
    await page.waitForChanges();
    expect(inputs().every(input => !input.disabled)).toBe(true);
  });
});
