import {
  resolveFormFieldNode,
  type FormFieldDefinitions
} from '../form-field-definition-resolver';
import type { FormField } from '../types';

/** 字段值变化订阅函数。 */
export type FormValueSubscriber = (value: unknown) => void;

/**
 * 保存单个表单中全部已挂载字段的当前值。
 *
 * 字段使用完整唯一标识读写，组件数据参数等派生能力可以同步读取并订阅
 * 值变化。
 */
export class FormValueStore {
  /** 按字段完整唯一标识保存的当前值。 */
  private readonly values = new Map<string, unknown>();
  /** 按字段完整唯一标识保存的值变化订阅。 */
  private readonly subscribers = new Map<string, Set<FormValueSubscriber>>();

  /** 判断指定字段是否已经写入过值。 */
  hasValue(fieldId: string): boolean {
    return this.values.has(fieldId);
  }

  /** 获取指定字段的当前值；字段尚未写入时返回 undefined。 */
  getValue(fieldId: string): unknown {
    return this.values.get(fieldId);
  }

  /** 写入字段当前值，并通知该字段的全部订阅者。 */
  setValue(fieldId: string, value: unknown): void {
    if (this.values.has(fieldId) && Object.is(this.values.get(fieldId), value)) {
      return;
    }
    this.values.set(fieldId, value);
    this.notify(fieldId, value);
  }

  /**
   * 使用一组最新字段值替换指定字段分支。
   *
   * 新值中不再存在的后代会被删除，其余字段仅在值实际变化时通知
   * 订阅者。
   */
  replaceBranch(
    fieldId: string,
    branchValues: ReadonlyMap<string, unknown>
  ): void {
    const descendantPrefix = `${fieldId}.`;
    const arrayElementPrefix = `${fieldId}[`;
    Array.from(this.values.keys()).forEach(storedFieldId => {
      const belongsToBranch = storedFieldId === fieldId
        || storedFieldId.startsWith(descendantPrefix)
        || storedFieldId.startsWith(arrayElementPrefix);
      if (belongsToBranch && !branchValues.has(storedFieldId)) {
        this.values.delete(storedFieldId);
        this.notify(storedFieldId, undefined);
      }
    });
    branchValues.forEach((value, branchFieldId) => {
      this.setValue(branchFieldId, value);
    });
  }

  /**
   * 订阅指定字段的值变化并返回清理函数。
   *
   * replayCurrent 为 true 且字段已有值时，会立即向订阅者发送当前值。
   */
  subscribe(
    fieldId: string,
    subscriber: FormValueSubscriber,
    replayCurrent = false
  ): () => void {
    const subscribers = this.subscribers.get(fieldId)
      ?? new Set<FormValueSubscriber>();
    subscribers.add(subscriber);
    this.subscribers.set(fieldId, subscribers);

    if (replayCurrent && this.values.has(fieldId)) {
      subscriber(this.values.get(fieldId));
    }

    return () => {
      subscribers.delete(subscriber);
      if (subscribers.size === 0) this.subscribers.delete(fieldId);
    };
  }

  /**
   * 删除指定字段及其全部后代字段值。
   *
   * 订阅关系会保留，以便同一动态字段标识再次出现时继续接收新值。
   */
  deleteBranch(fieldId: string): void {
    const descendantPrefix = `${fieldId}.`;
    const arrayElementPrefix = `${fieldId}[`;
    Array.from(this.values.keys()).forEach(storedFieldId => {
      if (
        storedFieldId === fieldId
        || storedFieldId.startsWith(descendantPrefix)
        || storedFieldId.startsWith(arrayElementPrefix)
      ) {
        this.values.delete(storedFieldId);
        this.notify(storedFieldId, undefined);
      }
    });
  }

  /** 通知指定字段的全部值变化订阅者。 */
  private notify(fieldId: string, value: unknown): void {
    const subscribers = this.subscribers.get(fieldId);
    if (!subscribers) return;
    Array.from(subscribers).forEach(subscriber => subscriber(value));
  }
}

/** 将一个字段值及其对象或数组后代同步到表单字段值存储。 */
export function synchronizeFormFieldValue(
  store: FormValueStore,
  field: FormField,
  fieldId: string,
  value: unknown,
  definitions: FormFieldDefinitions = {},
  maxDepth = 32
): void {
  const branchValues = new Map<string, unknown>();
  collectFormFieldValues(
    field,
    fieldId,
    value,
    branchValues,
    definitions,
    maxDepth,
    0
  );
  store.replaceBranch(fieldId, branchValues);
}

/** 递归收集字段值树中的完整字段标识和值。 */
function collectFormFieldValues(
  field: FormField,
  fieldId: string,
  value: unknown,
  values: Map<string, unknown>,
  definitions: FormFieldDefinitions,
  maxDepth: number,
  depth: number
): void {
  const normalizedValue = value === undefined ? null : value;
  values.set(fieldId, normalizedValue);
  if (depth >= maxDepth) return;

  if (field.category === 'object') {
    if (!isValueRecord(normalizedValue)) return;
    (field.fields ?? []).forEach(childFieldNode => {
      const childField = resolveFormFieldNode(childFieldNode, definitions);
      if (!childField) return;
      if (!childField.key) return;
      collectFormFieldValues(
        childField,
        `${fieldId}.${childField.key}`,
        normalizedValue[childField.key],
        values,
        definitions,
        maxDepth,
        depth + 1
      );
    });
    return;
  }

  if (field.category === 'record') {
    if (!isValueRecord(normalizedValue) || !field.kvDef) return;
    const valueField = resolveFormFieldNode(field.kvDef.value, definitions);
    if (!valueField) return;
    Object.entries(normalizedValue).forEach(([key, item], index) => {
      values.set(`${fieldId}[${index}].key`, key);
      collectFormFieldValues(
        valueField,
        `${fieldId}[${index}].value`,
        item,
        values,
        definitions,
        maxDepth,
        depth + 1
      );
    });
    return;
  }

  if (
    field.category !== 'array'
    || !Array.isArray(normalizedValue)
    || !field.element
  ) {
    return;
  }
  const element = resolveFormFieldNode(field.element, definitions);
  if (!element) return;
  normalizedValue.forEach((item, index) => {
    collectFormFieldValues(
      element,
      `${fieldId}[${index}]`,
      item,
      values,
      definitions,
      maxDepth,
      depth + 1
    );
  });
}

/** 判断字段值是否为可读取子字段的普通对象。 */
function isValueRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
