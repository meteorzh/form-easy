import { validateFormSchema } from './index';

describe('表单名称结构校验', () => {
  it.each([
    ['未设置', {}],
    ['空串', { name: '' }],
    ['只有空白', { name: '   ' }],
    ['普通名称', { name: '订单表单' }]
  ])('%s时校验通过', (_label, extra) => {
    const result = validateFormSchema({ key: 'nameCheck', fields: [], ...extra });

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it.each([
    ['null', null],
    ['数字', 1],
    ['对象', { text: '订单' }]
  ])('为%s时报错', (_label, name) => {
    const result = validateFormSchema({ key: 'nameCheck', name, fields: [] });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      expect.objectContaining({ path: '$.name', message: '表单名称必须是字符串。' })
    ]);
  });
});
