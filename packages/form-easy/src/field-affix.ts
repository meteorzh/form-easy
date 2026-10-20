import type {
  FieldAffix,
  FieldAffixEventBinding,
  FieldAffixNativeEvent,
  FieldAffixSlot,
  FieldAffixes,
  FormField
} from './form-field-types';

/** 展示文本和替代文本允许的最大长度。 */
export const fieldAffixTextMaxLength = 200;
/** 用户事件名称允许的最大长度。 */
export const fieldAffixActionNameMaxLength = 64;
/** 用户事件静态数据允许的最大嵌套层数。 */
const fieldAffixPayloadMaxDepth = 8;
/** 用户事件名称格式。 */
const fieldAffixActionNamePattern = /^[A-Za-z][A-Za-z0-9_-]*$/;
/** 四个展示位在 schema 中的属性名。 */
export const fieldAffixSlots: readonly FieldAffixSlot[] = [
  'labelBefore',
  'labelAfter',
  'controlBefore',
  'controlAfter'
];
/** 展示元素类型。 */
const fieldAffixTypes = new Set(['text', 'link', 'image', 'icon']);
/** 展示元素可以绑定的原生事件。 */
export const fieldAffixNativeEvents: readonly FieldAffixNativeEvent[] = [
  'click',
  'dblclick',
  'mousedown',
  'mouseup',
  'mouseenter',
  'mouseleave',
  'contextmenu'
];
/** 各展示元素允许配置的属性。 */
const fieldAffixProperties: Record<FieldAffix['type'], readonly string[]> = {
  text: ['type', 'text', 'events'],
  link: ['type', 'text', 'href', 'target', 'events'],
  image: ['type', 'src', 'alt', 'events'],
  icon: ['type', 'src', 'alt', 'events']
};
/** 超链接允许的绝对地址协议。 */
const linkProtocols = new Set(['http:', 'https:', 'mailto:', 'tel:']);
/** 图片和图标允许的绝对地址协议。 */
const assetProtocols = new Set(['http:', 'https:']);

/** 校验问题使用的稳定代码。 */
export type FieldAffixIssueCode =
  | 'invalid-type'
  | 'invalid-value'
  | 'missing-property'
  | 'unknown-property'
  | 'forbidden-property';

/** 展示位配置中的一个可定位问题。 */
export interface FieldAffixIssue {
  /** 问题代码，与 schema 校验问题代码一致。 */
  code: FieldAffixIssueCode;
  /** 问题所在的 JSON 风格路径。 */
  path: string;
  /** 面向开发者的中文说明。 */
  message: string;
}

/** 渲染时已经确认有效的展示元素。 */
/** 渲染时已经确认有效的一条用户事件绑定。 */
export interface RenderedFieldAffixEvent {
  /** 原生事件名。 */
  event: FieldAffixNativeEvent;
  /** 用户事件名。 */
  name: string;
  /** 静态 JSON 数据。 */
  payload?: unknown;
}

/** 渲染时已经确认有效的展示元素。 */
export type RenderedFieldAffix =
  | { type: 'text'; text: string; events?: RenderedFieldAffixEvent[] }
  | {
    type: 'link';
    text: string;
    href?: string;
    target: '_self' | '_blank';
    events?: RenderedFieldAffixEvent[];
  }
  | { type: 'image'; src: string; alt: string; events?: RenderedFieldAffixEvent[] }
  | { type: 'icon'; src: string; alt?: string; events?: RenderedFieldAffixEvent[] };

/** 判断值是否为普通对象。 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** 判断对象是否声明了指定属性。 */
function hasOwn(value: Record<string, unknown>, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, property);
}

/** 拼接对象属性路径。 */
function propertyPath(path: string, property: string): string {
  return `${path}.${property}`;
}

/** 拼接数组元素路径。 */
function indexPath(path: string, index: number): string {
  return `${path}[${index}]`;
}

/**
 * 判断地址是否使用允许的绝对协议，或是不带 scheme 的相对路径。
 * 协议相对地址和未知 scheme 一律拒绝。
 */
function isAllowedUrl(value: string, protocols: ReadonlySet<string>): boolean {
  const target = value.trim();
  if (!target || /\s/.test(target) || target.startsWith('//')) return false;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target)) return true;
  try {
    return protocols.has(new URL(target).protocol);
  } catch {
    return false;
  }
}

/** 判断超链接地址是否安全。 */
export function isAllowedAffixLinkHref(value: string): boolean {
  return isAllowedUrl(value, linkProtocols);
}

/** 判断图片或图标地址是否安全。 */
export function isAllowedAffixAssetSrc(value: string): boolean {
  return isAllowedUrl(value, assetProtocols);
}

/** 判断用户事件名称是否符合稳定标识格式。 */
export function isAffixActionName(value: string): boolean {
  return value.length <= fieldAffixActionNameMaxLength
    && fieldAffixActionNamePattern.test(value);
}

/** 判断用户事件数据是否为有限深度的纯 JSON 值。 */
export function isJsonPayload(value: unknown, depth = 0, seen = new Set<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  if (depth >= fieldAffixPayloadMaxDepth || seen.has(value)) return false;
  if (!Array.isArray(value) && !isPlainRecord(value)) return false;
  seen.add(value);
  const children = Array.isArray(value) ? value : Object.values(value);
  const valid = children.every(child => isJsonPayload(child, depth + 1, seen));
  seen.delete(value);
  return valid;
}

/** 读取去掉首尾空白后的非空字符串。 */
function readTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** 控件区较高、不适合在控件两侧放展示内容的字段分类。 */
const tallFieldCategories = new Set(['array', 'object', 'record']);

/** 判断字段分类是否禁止配置控件前后的展示位。 */
export function isTallFieldCategory(category: unknown): boolean {
  return typeof category === 'string' && tallFieldCategories.has(category);
}

/**
 * 数组、对象和 record 的控件较高，不允许配置控件前后的展示位。
 * 标签前后的展示位仍然可用。
 */
export function validateTallFieldControlAffixes(
  category: unknown,
  affixes: unknown,
  path: string
): FieldAffixIssue[] {
  if (!isTallFieldCategory(category) || !isPlainRecord(affixes)) return [];
  return (['controlBefore', 'controlAfter'] as const).flatMap(slot => (
    hasOwn(affixes, slot)
      ? [{
        code: 'forbidden-property',
        path: propertyPath(path, slot),
        message: '数组、对象和 record 字段不能配置控件前后的展示位。'
      }]
      : []
  ));
}

/** 校验一份展示位配置，不修改原对象。 */
export function validateFieldAffixes(value: unknown, path: string): FieldAffixIssue[] {
  if (!isPlainRecord(value)) {
    return [{
      code: 'invalid-type',
      path,
      message: 'affixes 必须是普通对象。'
    }];
  }
  const issues: FieldAffixIssue[] = [];
  Object.keys(value).forEach(property => {
    if (!fieldAffixSlots.includes(property as FieldAffixSlot)) {
      issues.push({
        code: 'unknown-property',
        path: propertyPath(path, property),
        message: `不支持的配置属性“${property}”。`
      });
    }
  });
  fieldAffixSlots.forEach(slot => {
    if (!hasOwn(value, slot)) return;
    issues.push(...validateAffixList(value[slot], propertyPath(path, slot)));
  });
  return issues;
}

/** 校验一个展示位中的元素数组。 */
function validateAffixList(value: unknown, path: string): FieldAffixIssue[] {
  if (!Array.isArray(value)) {
    return [{
      code: 'invalid-type',
      path,
      message: '展示位必须是数组。'
    }];
  }
  return value.flatMap((item, index) => validateAffixItem(item, indexPath(path, index)));
}

/** 校验单个展示元素。 */
function validateAffixItem(value: unknown, path: string): FieldAffixIssue[] {
  if (!isPlainRecord(value)) {
    return [{
      code: 'invalid-type',
      path,
      message: '展示元素必须是普通对象。'
    }];
  }
  if (!hasOwn(value, 'type')) {
    return [{
      code: 'missing-property',
      path: propertyPath(path, 'type'),
      message: '展示元素缺少必需的 type。'
    }];
  }
  if (typeof value.type !== 'string' || !fieldAffixTypes.has(value.type)) {
    return [{
      code: 'invalid-value',
      path: propertyPath(path, 'type'),
      message: '展示元素 type 必须是 text、link、image 或 icon。'
    }];
  }
  const type = value.type as FieldAffix['type'];
  const issues: FieldAffixIssue[] = [];
  const allowed = new Set(fieldAffixProperties[type]);
  Object.keys(value).forEach(property => {
    if (!allowed.has(property)) {
      issues.push({
        code: 'unknown-property',
        path: propertyPath(path, property),
        message: `不支持的配置属性“${property}”。`
      });
    }
  });
  if (type === 'text' || type === 'link') {
    issues.push(...validateDisplayText(value.text, propertyPath(path, 'text'), '展示文本'));
  }
  if (type === 'link') issues.push(...validateAffixLink(value, path));
  if (type === 'image' || type === 'icon') {
    issues.push(...validateAssetSource(value.src, propertyPath(path, 'src')));
  }
  if (type === 'image') {
    issues.push(...validateDisplayText(value.alt, propertyPath(path, 'alt'), '图片替代文本'));
  }
  if (type === 'icon' && hasOwn(value, 'alt') && !readDisplayText(value.alt)) {
    issues.push({
      code: 'invalid-value',
      path: propertyPath(path, 'alt'),
      message: '图标替代文本必须是不超过 200 个字符的非空字符串。'
    });
  }
  if (hasOwn(value, 'events')) {
    issues.push(...validateAffixEvents(value.events, propertyPath(path, 'events')));
  }
  return issues;
}

/** 校验超链接的地址、目标和用户事件。 */
function validateAffixLink(
  value: Record<string, unknown>,
  path: string
): FieldAffixIssue[] {
  const issues: FieldAffixIssue[] = [];
  const hrefPath = propertyPath(path, 'href');
  const hasHref = hasOwn(value, 'href');
  const hasEvents = Array.isArray(value.events) && value.events.length > 0;
  if (!hasHref && !hasEvents) {
    issues.push({
      code: 'missing-property',
      path,
      message: '超链接必须配置 href 或 events。'
    });
  }
  if (hasHref && !isAllowedAffixLinkHref(typeof value.href === 'string' ? value.href : '')) {
    issues.push({
      code: 'invalid-value',
      path: hrefPath,
      message: '链接地址只允许 http、https、mailto、tel 或不带协议的相对路径。'
    });
  }
  if (hasOwn(value, 'target')) {
    if (!hasHref) {
      issues.push({
        code: 'invalid-value',
        path: propertyPath(path, 'target'),
        message: '只有配置 href 时才能设置 target。'
      });
    } else if (value.target !== '_self' && value.target !== '_blank') {
      issues.push({
        code: 'invalid-value',
        path: propertyPath(path, 'target'),
        message: '链接 target 必须是 _self 或 _blank。'
      });
    }
  }
  return issues;
}

/** 校验展示元素上的原生事件映射。 */
function validateAffixEvents(value: unknown, path: string): FieldAffixIssue[] {
  if (!Array.isArray(value)) {
    return [{
      code: 'invalid-type',
      path,
      message: 'events 必须是数组。'
    }];
  }
  const issues: FieldAffixIssue[] = [];
  const seen = new Set<string>();
  value.forEach((item, index) => {
    const itemPath = indexPath(path, index);
    if (!isPlainRecord(item)) {
      issues.push({
        code: 'invalid-type',
        path: itemPath,
        message: '用户事件绑定必须是普通对象。'
      });
      return;
    }
    Object.keys(item).forEach(property => {
      if (property !== 'event' && property !== 'name' && property !== 'payload') {
        issues.push({
          code: 'unknown-property',
          path: propertyPath(itemPath, property),
          message: `不支持的配置属性“${property}”。`
        });
      }
    });
    if (!hasOwn(item, 'event')) {
      issues.push({
        code: 'missing-property',
        path: propertyPath(itemPath, 'event'),
        message: '用户事件绑定缺少必需的 event。'
      });
    } else if (!fieldAffixNativeEvents.includes(item.event as FieldAffixNativeEvent)) {
      issues.push({
        code: 'invalid-value',
        path: propertyPath(itemPath, 'event'),
        message: `event 必须是 ${fieldAffixNativeEvents.join('、')} 之一。双击请使用 dblclick。`
      });
    }
    const name = readTrimmedString(item.name);
    if (!hasOwn(item, 'name')) {
      issues.push({
        code: 'missing-property',
        path: propertyPath(itemPath, 'name'),
        message: '用户事件绑定缺少必需的 name。'
      });
    } else if (!name || !isAffixActionName(name)) {
      issues.push({
        code: 'invalid-value',
        path: propertyPath(itemPath, 'name'),
        message: '事件名称必须以字母开头，只包含字母、数字、下划线或连字符，并且不超过 64 个字符。'
      });
    }
    if (hasOwn(item, 'payload') && !isJsonPayload(item.payload)) {
      issues.push({
        code: 'invalid-value',
        path: propertyPath(itemPath, 'payload'),
        message: '事件 payload 必须是嵌套不超过 8 层的纯 JSON 数据。'
      });
    }
    if (typeof item.event === 'string' && name) {
      const identity = `${item.event}::${name}`;
      if (seen.has(identity)) {
        issues.push({
          code: 'invalid-value',
          path: itemPath,
          message: `原生事件 ${item.event} 不能重复绑定用户事件“${name}”。`
        });
      }
      seen.add(identity);
    }
  });
  return issues;
}

/** 校验图片或图标地址。 */
function validateAssetSource(value: unknown, path: string): FieldAffixIssue[] {
  if (typeof value === 'string' && isAllowedAffixAssetSrc(value)) return [];
  return [{
    code: 'invalid-value',
    path,
    message: '资源地址只允许 http、https 或不带协议的相对路径。'
  }];
}

/** 校验展示用的非空文本。 */
function validateDisplayText(
  value: unknown,
  path: string,
  description: string
): FieldAffixIssue[] {
  if (readDisplayText(value)) return [];
  return [{
    code: 'invalid-value',
    path,
    message: `${description}必须是不超过 ${fieldAffixTextMaxLength} 个字符的非空字符串。`
  }];
}

/** 读取长度合法的展示文本。 */
function readDisplayText(value: unknown): string | undefined {
  const text = readTrimmedString(value);
  if (!text || text.length > fieldAffixTextMaxLength) return undefined;
  return text;
}

/** 把合法的展示位配置转换成渲染数据；非法元素会被跳过。 */
export function readRenderableAffixes(value: unknown): Record<FieldAffixSlot, RenderedFieldAffix[]> {
  const rendered: Record<FieldAffixSlot, RenderedFieldAffix[]> = {
    labelBefore: [],
    labelAfter: [],
    controlBefore: [],
    controlAfter: []
  };
  if (!isPlainRecord(value)) return rendered;
  fieldAffixSlots.forEach(slot => {
    const list = value[slot];
    if (!Array.isArray(list)) return;
    rendered[slot] = list.flatMap(item => (
      validateAffixItem(item, 'item').length > 0
        ? []
        : [readAffixItem(item as FieldAffix)]
    ));
  });
  return rendered;
}

/** 规范化一个已经通过校验的展示元素。 */
function readAffixItem(item: FieldAffix): RenderedFieldAffix {
  const events = readAffixEvents(item.events);
  if (item.type === 'text') {
    return { type: 'text', text: item.text.trim(), ...(events ? { events } : {}) };
  }
  if (item.type === 'image') {
    return {
      type: 'image',
      src: item.src.trim(),
      alt: item.alt.trim(),
      ...(events ? { events } : {})
    };
  }
  if (item.type === 'icon') {
    const alt = readDisplayText(item.alt);
    return {
      type: 'icon',
      src: item.src.trim(),
      ...(alt ? { alt } : {}),
      ...(events ? { events } : {})
    };
  }
  return {
    type: 'link',
    text: item.text.trim(),
    ...(item.href ? { href: item.href.trim() } : {}),
    target: item.target ?? '_self',
    ...(events ? { events } : {})
  };
}

/** 读取已经通过校验的用户事件绑定。 */
function readAffixEvents(
  events: FieldAffixEventBinding[] | undefined
): RenderedFieldAffixEvent[] | undefined {
  if (!events?.length) return undefined;
  return events.map(binding => ({
    event: binding.event,
    name: binding.name.trim(),
    ...(Object.prototype.hasOwnProperty.call(binding, 'payload')
      ? { payload: binding.payload }
      : {})
  }));
}

/** 返回去掉展示位后的字段。数组元素渲染时使用，避免重复模板上的 affixes。 */
export function omitFieldAffixes<T extends Pick<FormField, 'affixes'>>(field: T): T {
  if (!Object.prototype.hasOwnProperty.call(field, 'affixes')) return field;
  const { affixes: _affixes, ...rest } = field;
  return rest as T;
}

/** 原生事件名对应的 Stencil 事件属性。 */
export const affixNativeEventProp: Record<FieldAffixNativeEvent, string> = {
  click: 'onClick',
  dblclick: 'onDblClick',
  mousedown: 'onMouseDown',
  mouseup: 'onMouseUp',
  mouseenter: 'onMouseEnter',
  mouseleave: 'onMouseLeave',
  contextmenu: 'onContextMenu'
};

/** 判断点击是否应保留浏览器自己的链接行为。 */
export function isModifiedAffixClick(event: MouseEvent): boolean {
  return event.button !== 0
    || event.metaKey
    || event.ctrlKey
    || event.shiftKey
    || event.altKey;
}

/** 判断展示位属于标签还是控件。 */
export function fieldAffixSide(slot: FieldAffixSlot): 'label' | 'control' {
  return slot.startsWith('label') ? 'label' : 'control';
}

/** 返回展示位对应的 shadow part 名称。 */
export function fieldAffixPart(slot: FieldAffixSlot): string {
  return slot.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
}

/** 读取一份可选的展示位配置；字段未配置时返回四个空数组。 */
export function readFieldAffixes(field: Pick<FormField, 'affixes' | 'category'>): Record<
  FieldAffixSlot,
  RenderedFieldAffix[]
> {
  const affixes = readRenderableAffixes(field.affixes ?? {});
  if (!isTallFieldCategory(field.category)) return affixes;
  return {
    ...affixes,
    controlBefore: [],
    controlAfter: []
  };
}
