import { h } from '@stencil/core';
import { newSpecPage } from '@stencil/core/testing';
import { FormEasy } from './components/form-easy/form-easy';
import { FormEasyArray } from './components/form-easy-array/form-easy-array';
import { FormEasyField } from './components/form-easy-field/form-easy-field';
import { FormEasyObject } from './components/form-easy-object/form-easy-object';
import { FormEasyRecord } from './components/form-easy-record/form-easy-record';
import { EventCenter, type UserEvent } from './managers/event-center';
import type { BasicFieldRenderer } from './renderers/basic-field-renderer';
import type { FormSchema } from './types';
import { validateFormSchema } from './validation/schema';

/** 展示位测试不需要真实输入控件。 */
function createTestRenderer(): BasicFieldRenderer {
  return {
    /** 展示位位于控件外部，测试不渲染输入框。 */
    render: () => undefined,
    /** 测试渲染器没有需要释放的实例。 */
    unmount: () => undefined
  };
}

/** 创建一个带四个展示位的价格字段表单。 */
function createPriceSchema(): FormSchema {
  return {
    key: 'order',
    name: '订单',
    fields: [
      {
        key: 'price',
        name: '价格',
        category: 'basic',
        dataType: 'number',
        affixes: {
          labelBefore: [{ type: 'text', text: 'A.' }],
          labelAfter: [
            {
              type: 'link',
              text: '计价说明',
              events: [
                { event: 'click', name: 'openPriceHelp', payload: { topic: 'price' } }
              ]
            }
          ],
          controlBefore: [
            { type: 'icon', src: '/icons/currency.svg' },
            { type: 'text', text: '¥' }
          ],
          controlAfter: [
            { type: 'text', text: '元' },
            {
              type: 'image',
              src: 'https://cdn.example.com/coin.png',
              alt: '货币示意图'
            }
          ]
        }
      }
    ]
  };
}

/** 渲染表单并等待字段完成首次更新。 */
async function renderForm(schema: FormSchema, eventCenter?: EventCenter) {
  const page = await newSpecPage({
    components: [
      FormEasy,
      FormEasyField,
      FormEasyArray,
      FormEasyObject,
      FormEasyRecord
    ],
    template: () => (
      <form-easy
        schema={schema}
        basicFieldRenderer={createTestRenderer()}
        eventCenter={eventCenter}
      />
    )
  });
  await page.waitForChanges();
  return page;
}

describe('字段展示位', () => {
  it('按位置渲染文本、链接、图片和图标，并且不写入表单值', async () => {
    const page = await renderForm(createPriceSchema());
    const field = page.root!.querySelector('form-easy-field')!;
    const text = Array.from(field.querySelectorAll('.field-affix-text'))
      .map(element => element.textContent);

    expect(text).toEqual(['A.', '¥', '元']);
    expect(field.querySelector('.field-affix-link')?.textContent).toBe('计价说明');
    expect(field.querySelector('.field-affix-icon')).not.toBeNull();
    expect(field.querySelector('.field-affix-image--label')).toBeNull();
    expect(field.querySelector('.field-affix-image--control')).not.toBeNull();
    expect(field.querySelector('.field-label-text')?.textContent).toContain('价格');
    expect((page.rootInstance as { formData: unknown }).formData).toEqual({ price: null });
  });

  it('没有字段名但有标签展示位时保留标签列，只有控件展示位时保持单列', async () => {
    const page = await renderForm({
      key: 'layoutForm',
      name: '布局',
      fields: [
        {
          key: 'labelOnly',
          name: ' ',
          category: 'basic',
          dataType: 'string',
          affixes: {
            labelBefore: [{ type: 'text', text: '标签前' }]
          }
        },
        {
          key: 'controlOnly',
          name: ' ',
          category: 'basic',
          dataType: 'string',
          affixes: {
            controlAfter: [{ type: 'text', text: '单位' }]
          }
        }
      ]
    });
    const fields = Array.from(page.root!.querySelectorAll('form-easy-field'));

    expect(fields[0].querySelector('.field')?.classList.contains('field--editor-only')).toBe(false);
    expect(fields[0].querySelector('.field-label')).not.toBeNull();
    expect(fields[1].querySelector('.field')?.classList.contains('field--editor-only')).toBe(true);
    expect(fields[1].querySelector('.field-label')).toBeNull();
    expect(fields[1].querySelector('.field-affix-text')?.textContent).toBe('单位');
  });

  it('optional 收起时隐藏控件展示位，但保留标签展示位', async () => {
    const page = await renderForm({
      key: 'optionalForm',
      name: '可选',
      fields: [
        {
          key: 'price',
          name: '价格',
          category: 'basic',
          dataType: 'number',
          optional: true,
          affixes: {
            labelBefore: [{ type: 'text', text: '标签' }],
            controlAfter: [{ type: 'text', text: '元' }]
          }
        }
      ]
    });
    const field = page.root!.querySelector('form-easy-field')!;

    expect(field.querySelector('.editor')).toBeNull();
    expect(field.textContent).toContain('标签');
    expect(field.textContent).not.toContain('元');
  });

  it('隐藏字段不渲染展示位，禁用字段仍可触发用户事件', async () => {
    const eventCenter = new EventCenter();
    const events: UserEvent[] = [];
    eventCenter.addUserEventListener(event => {
      events.push(event);
    });
    const page = await renderForm({
      key: 'stateForm',
      name: '状态',
      fields: [
        {
          key: 'price',
          name: '价格',
          category: 'basic',
          dataType: 'number',
          affixes: {
            labelAfter: [
              {
                type: 'link',
                text: '说明',
                events: [{ event: 'click', name: 'openPriceHelp' }]
              }
            ]
          }
        }
      ]
    }, eventCenter);
    const field = page.root!.querySelector('form-easy-field') as HTMLElement & {
      /** 执行字段显示和禁用命令。 */
      applyHandle(handle: 'hide' | 'disable'): Promise<void>;
    };

    await field.applyHandle('disable');
    await page.waitForChanges();
    field.querySelector<HTMLButtonElement>('.field-affix-link')!.click();
    expect(events.map(event => event.name)).toEqual(['openPriceHelp']);

    await field.applyHandle('hide');
    await page.waitForChanges();
    expect(field.querySelector('.field-affix-link')).toBeNull();
  });

  it('数组字段不渲染控件两侧的展示位，但保留标签两侧', async () => {
    const page = await renderForm({
      key: 'tallForm',
      name: '高控件',
      fields: [
        {
          key: 'items',
          name: '多项',
          category: 'array',
          defaultValue: ['第一项'],
          element: { category: 'basic', dataType: 'string' },
          affixes: {
            labelBefore: [{ type: 'text', text: '列表' }],
            controlAfter: [{ type: 'text', text: '不应出现' }]
          }
        }
      ]
    });
    const text = page.root!.textContent ?? '';

    expect(text).toContain('列表');
    expect(text).not.toContain('不应出现');
  });

  it('数组元素丢弃模板展示位，元素内部的命名字段仍然保留', async () => {
    const page = await renderForm({
      key: 'listForm',
      name: '列表',
      definitions: {
        price: {
          category: 'basic',
          dataType: 'number',
          affixes: {
            controlAfter: [{ type: 'text', text: '元' }]
          }
        }
      },
      fields: [
        {
          $ref: 'price',
          key: 'single',
          name: '单价'
        },
        {
          key: 'items',
          name: '多项',
          category: 'array',
          defaultValue: [1],
          element: { $ref: 'price' }
        },
        {
          key: 'entries',
          name: '条目',
          category: 'array',
          defaultValue: [{ amount: 2 }],
          element: {
            category: 'object',
            fields: [
              {
                key: 'amount',
                name: '金额',
                category: 'basic',
                dataType: 'number',
                affixes: {
                  controlAfter: [{ type: 'text', text: '元' }]
                }
              }
            ]
          }
        }
      ]
    });
    const texts = Array.from(page.root!.querySelectorAll('.field-affix-text'))
      .map(element => element.textContent);

    expect(texts.filter(text => text === '元')).toHaveLength(2);
  });

  it('record value 展示位出现在每个动态值上，key 上的展示位不会渲染', async () => {
    const page = await renderForm({
      key: 'recordForm',
      name: '动态属性',
      fields: [
        {
          key: 'bag',
          name: '背包',
          category: 'record',
          defaultValue: { sword: 1 },
          kvDef: {
            key: {
              affixes: {
                labelBefore: [{ type: 'text', text: '键前缀' }]
              }
            },
            value: {
              category: 'basic',
              dataType: 'number',
              affixes: {
                controlAfter: [{ type: 'text', text: '件' }]
              }
            }
          }
        }
      ]
    } as unknown as FormSchema);
    const text = page.root!.textContent ?? '';

    expect(text).toContain('件');
    expect(text).not.toContain('键前缀');
    const fields = Array.from(page.root!.querySelectorAll('form-easy-field'));
    expect(fields[0].querySelector('.field')?.classList.contains('field--tall')).toBe(true);
    expect(fields.filter(field =>
      field.querySelector('.field')?.classList.contains('field--top')
    ).length).toBeGreaterThanOrEqual(2);
  });

  it('链接派发 affix 用户事件，取消或修饰键点击都不会打开新页面', async () => {
    const eventCenter = new EventCenter();
    const events: UserEvent[] = [];
    eventCenter.addUserEventListener(event => {
      events.push(event);
      return false;
    });
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    const page = await renderForm({
      key: 'linkForm',
      name: '链接',
      fields: [
        {
          key: 'price',
          name: '价格',
          category: 'basic',
          dataType: 'number',
          affixes: {
            labelAfter: [
              {
                type: 'link',
                text: '外部说明',
                href: 'https://example.com/help',
                target: '_blank',
                events: [
                  { event: 'click', name: 'openPriceHelp', payload: { topic: 'price' } }
                ]
              }
            ],
            controlAfter: [
              {
                type: 'link',
                text: '只发事件',
                events: [{ event: 'click', name: 'showUnit' }]
              },
              {
                type: 'text',
                text: '按下',
                events: [{ event: 'mousedown', name: 'pressUnit' }]
              }
            ]
          }
        }
      ]
    }, eventCenter);
    const domEvents: UserEvent[] = [];
    page.root!.addEventListener('userEvent', event => {
      domEvents.push((event as CustomEvent<UserEvent>).detail);
      event.preventDefault();
    });
    const links = Array.from(page.root!.querySelectorAll<HTMLElement>('.field-affix-link'));

    const primaryClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    links[1].dispatchEvent(primaryClick);
    page.root!.querySelector<HTMLElement>('.field-affix-text')!
      .dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    links[0].dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true
    }));
    links[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(events.map(event => event.source.event)).toEqual(['click', 'mousedown', 'click']);
    expect(events.map(event => event.name)).toEqual(['showUnit', 'pressUnit', 'openPriceHelp']);
    expect(domEvents).toHaveLength(3);
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('图片只打开大图，Escape 关闭后焦点回到缩略图', async () => {
    const eventCenter = new EventCenter();
    const events: UserEvent[] = [];
    eventCenter.addUserEventListener(event => {
      events.push(event);
    });
    const page = await renderForm({
      key: 'imageForm',
      name: '图片',
      fields: [
        {
          key: 'price',
          name: '价格',
          category: 'basic',
          dataType: 'number',
          affixes: {
            labelBefore: [
              { type: 'image', src: '/coin.png', alt: '标签图' }
            ],
            controlAfter: [
              { type: 'image', src: 'https://cdn.example.com/coin.png', alt: '控件图' }
            ]
          }
        }
      ]
    }, eventCenter);
    const images = Array.from(
      page.root!.querySelectorAll<HTMLButtonElement>('.field-affix-image')
    );
    expect(images[0].classList.contains('field-affix-image--label')).toBe(true);
    expect(images[1].classList.contains('field-affix-image--control')).toBe(true);

    const focus = jest.spyOn(HTMLElement.prototype, 'focus').mockImplementation(() => undefined);
    images[1].click();
    await page.waitForChanges();
    const dialog = page.body.querySelector<HTMLElement>('.form-easy-affix-preview')!;
    expect(dialog).not.toBeNull();
    expect(dialog.parentElement).toBe(page.body);
    expect(events).toEqual([]);
    expect(focus.mock.instances).toContain(dialog.querySelector('button'));

    focus.mockClear();
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await page.waitForChanges();

    expect(page.body.querySelector('.form-easy-affix-preview')).toBeNull();
    expect(focus.mock.instances).toContain(images[1]);
    focus.mockRestore();
  });

  it('独立事件中心收不到全局用户事件，同步重入会停止', () => {
    const isolated = new EventCenter();
    const globalEvents: string[] = [];
    const isolatedEvents: string[] = [];
    const globalCenter = new EventCenter();
    globalCenter.addUserEventListener(event => {
      globalEvents.push(event.name);
    });
    isolated.addUserEventListener(event => {
      isolatedEvents.push(event.name);
    });
    const action = {
      name: 'openPriceHelp',
      formKey: 'order',
      source: {
        type: 'affix' as const,
        fieldId: 'order.price',
        slot: 'labelAfter' as const,
        index: 0,
        event: 'click' as const
      }
    };

    expect(globalCenter.dispatchUserEvent(action)).toBe(true);
    expect(globalEvents).toEqual(['openPriceHelp']);
    expect(isolatedEvents).toEqual([]);

    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    let calls = 0;
    isolated.addUserEventListener(() => {
      calls += 1;
      if (calls === 1) isolated.dispatchUserEvent(action);
    });
    expect(isolated.dispatchUserEvent(action)).toBe(true);
    expect(calls).toBe(1);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('展示位 schema 校验', () => {
  it('拒绝非法地址、超长文本、图片尺寸和缺少行为的链接', () => {
    const result = validateFormSchema({
      key: 'invalidAffix',
      name: '非法展示位',
      fields: [
        {
          key: 'price',
          name: '价格',
          category: 'basic',
          dataType: 'number',
          affixes: {
            labelBefore: [{ type: 'text', text: ' ' }],
            controlBefore: [
              {
                type: 'link',
                text: '链接'
              }
            ],
            controlAfter: [
              {
                type: 'image',
                src: 'javascript:alert(1)',
                alt: '图',
                width: 120
              }
            ]
          }
        }
      ]
    });
    const messages = result.errors.map(issue => `${issue.code}:${issue.path}`);

    expect(result.valid).toBe(false);
    expect(messages).toEqual(expect.arrayContaining([
      'invalid-value:$.fields[0].affixes.labelBefore[0].text',
      'missing-property:$.fields[0].affixes.controlBefore[0]',
      'invalid-value:$.fields[0].affixes.controlAfter[0].src',
      'unknown-property:$.fields[0].affixes.controlAfter[0].width'
    ]));
  });

  it('拒绝数组元素和 record key 上的 affixes，但允许命名覆盖', () => {
    const result = validateFormSchema({
      key: 'scope',
      name: '范围',
      definitions: {
        price: {
          category: 'basic',
          dataType: 'number',
          affixes: {
            controlAfter: [{ type: 'text', text: '元' }]
          }
        }
      },
      fields: [
        {
          $ref: 'price',
          key: 'single',
          name: '单价',
          affixes: {
            controlAfter: [{ type: 'text', text: '美元' }]
          }
        },
        {
          key: 'items',
          name: '多项',
          category: 'array',
          element: {
            $ref: 'price',
            affixes: {
              controlAfter: [{ type: 'text', text: '元' }]
            }
          }
        },
        {
          key: 'bag',
          name: '背包',
          category: 'record',
          kvDef: {
            key: {
              affixes: {
                labelBefore: [{ type: 'text', text: '键' }]
              }
            },
            value: {
              category: 'basic',
              dataType: 'number',
              affixes: {
                controlAfter: [{ type: 'text', text: '件' }]
              }
            }
          }
        }
      ]
    });

    expect(result.errors.map(issue => issue.path)).toEqual([
      '$.fields[1].element.affixes',
      '$.fields[2].kvDef.key.affixes'
    ]);
    expect(result.errors.map(issue => issue.code)).toEqual([
      'forbidden-property',
      'unknown-property'
    ]);
  });

  it('拒绝数组、对象和 record 字段配置控件前后的展示位', () => {
    const result = validateFormSchema({
      key: 'tallFields',
      name: '高控件字段',
      definitions: {
        group: {
          category: 'object',
          affixes: {
            controlBefore: [{ type: 'text', text: '模板' }]
          },
          fields: []
        }
      },
      fields: [
        {
          key: 'items',
          name: '多项',
          category: 'array',
          element: { category: 'basic', dataType: 'string' },
          affixes: {
            labelBefore: [{ type: 'text', text: '列表' }],
            controlAfter: [{ type: 'text', text: '项' }]
          }
        },
        {
          key: 'profile',
          name: '资料',
          category: 'object',
          fields: [],
          affixes: {
            controlBefore: [{ type: 'text', text: '前' }]
          }
        },
        {
          key: 'bag',
          name: '背包',
          category: 'record',
          affixes: {
            labelAfter: [{ type: 'text', text: '动态' }]
          },
          kvDef: {
            key: {},
            value: {
              category: 'object',
              affixes: {
                controlAfter: [{ type: 'text', text: '后' }]
              },
              fields: []
            }
          }
        },
        {
          $ref: 'group',
          key: 'copied',
          name: '引用对象',
          affixes: {
            controlAfter: [{ type: 'text', text: '覆盖' }]
          }
        }
      ]
    });

    expect(result.errors.map(issue => issue.path)).toEqual([
      '$.definitions.group.affixes.controlBefore',
      '$.fields[0].affixes.controlAfter',
      '$.fields[1].affixes.controlBefore',
      '$.fields[2].kvDef.value.affixes.controlAfter',
      '$.fields[3].affixes.controlAfter'
    ]);
    expect(result.errors.every(issue => issue.code === 'forbidden-property')).toBe(true);
  });
});
