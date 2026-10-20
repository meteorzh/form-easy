import type { FieldAffixNativeEvent, FieldAffixSlot } from '../form-field-types';
import type {
  ComponentEventName,
  ComponentHandle,
  EventFlowHistory,
  HandleTarget
} from '../types';

/** 展示位元素发出的用户事件来源。 */
export interface AffixUserEventSource {
  /** 用户事件入口类型。当前只有展示位。 */
  type: 'affix';
  /** 触发事件的字段完整标识。 */
  fieldId: string;
  /** 展示元素所在的位置。 */
  slot: FieldAffixSlot;
  /** 展示元素在该位置中的序号。 */
  index: number;
  /** 触发这次用户事件的原生事件名。 */
  event: FieldAffixNativeEvent;
}

/** 用户事件入口。以后可以在此增加 affix 以外的类型。 */
export type UserEventSource = AffixUserEventSource;

/** 由展示位或其他入口派发、供表单使用者响应的事件。 */
export interface UserEvent {
  /** 使用者识别事件的稳定名称。 */
  name: string;
  /** 派发该事件的表单键。 */
  formKey: string;
  /** 事件从哪个入口发出。 */
  source: UserEventSource;
  /** 入口声明的静态数据。 */
  payload?: unknown;
}

/** 用户事件监听器。返回 false 时取消入口的默认行为。 */
export type UserEventListener = (event: UserEvent) => void | false;

/** 生成用户事件在同步调用栈中的身份。 */
function userEventIdentity(event: UserEvent): string {
  const source = event.source;
  if (source.type === 'affix') {
    return [
      event.formKey,
      source.type,
      source.fieldId,
      source.slot,
      String(source.index),
      source.event,
      event.name
    ].join('::');
  }
  return `${event.formKey}::${event.name}`;
}

/** 一条事件路由记录。 */
interface SubscriptionRecord {
  /** 事件监听目标。 */
  target: HandleTarget;
  /** 当前订阅需要执行的操作命令。 */
  handle: ComponentHandle;
}

/** 将字段事件路由给订阅该事件的字段操作。 */
export class EventCenter {
  /** 按事件源和事件名称索引的订阅记录。 */
  private readonly subscriptions = new Map<string, Set<SubscriptionRecord>>();
  /** 当前注册的用户事件监听器。 */
  private readonly userEventListeners = new Set<UserEventListener>();
  /** 正在同步派发的用户事件身份。 */
  private readonly userEventStack: string[] = [];

  /** 添加事件订阅并返回清理函数。 */
  subscribe(
    sourceFieldId: string,
    eventName: ComponentEventName,
    target: HandleTarget,
    handle: ComponentHandle
  ): () => void {
    const key = this.createKey(sourceFieldId, eventName);
    const record: SubscriptionRecord = { target, handle };
    const records = this.subscriptions.get(key) ?? new Set<SubscriptionRecord>();
    records.add(record);
    this.subscriptions.set(key, records);

    return () => {
      records.delete(record);
      if (records.size === 0) this.subscriptions.delete(key);
    };
  }

  /**
   * 将事件发布给所有当前订阅目标。
   * 若同一事件已存在于本次事件流历史中，则停止传播并输出循环错误。
   */
  publish(
    sourceFieldId: string,
    eventName: ComponentEventName,
    value?: unknown,
    history: EventFlowHistory = []
  ): void {
    const eventId = this.createKey(sourceFieldId, eventName);
    if (history.includes(eventId)) {
      const chain = [...history, eventId].join(' -> ');
      console.error(new Error(`检测到 form-easy 事件循环，已停止事件传播：${chain}`));
      return;
    }

    const nextHistory = [...history, eventId];
    const records = this.subscriptions.get(eventId);
    records?.forEach(({ target, handle }) => target.applyHandle(handle, value, nextHistory));
  }

  /** 注册用户事件监听器，并返回取消注册的函数。 */
  addUserEventListener(listener: UserEventListener): () => void {
    this.userEventListeners.add(listener);
    return () => {
      this.userEventListeners.delete(listener);
    };
  }

  /**
   * 同步派发一个用户事件。
   * 任一监听器返回 false，或同一个事件身份发生同步重入时，返回 false。
   */
  dispatchUserEvent(event: UserEvent): boolean {
    const identity = userEventIdentity(event);
    if (this.userEventStack.includes(identity)) {
      const chain = [...this.userEventStack, identity].join(' -> ');
      console.error(new Error(`检测到 form-easy 用户事件重入，已停止事件传播：${chain}`));
      return false;
    }

    this.userEventStack.push(identity);
    try {
      let cancelled = false;
      [...this.userEventListeners].forEach(listener => {
        if (listener(event) === false) cancelled = true;
      });
      return !cancelled;
    } finally {
      this.userEventStack.pop();
    }
  }

  /** 创建避免冲突的事件映射键。 */
  private createKey(fieldId: string, eventName: ComponentEventName): string {
    return `${fieldId}::${eventName}`;
  }
}

/** 用于跨 form-easy 打包入口共享全局事件中心的注册键。 */
const GLOBAL_EVENT_CENTER_KEY = Symbol.for('form-easy.global-event-center');

/** 全局对象上保存事件中心实例的内部类型。 */
type GlobalEventCenterStore = typeof globalThis & {
  /** 可选的全局共享事件中心实例。 */
  [GLOBAL_EVENT_CENTER_KEY]?: EventCenter;
};

/** 全部未指定事件中心的表单共用的默认事件中心。 */
const globalEventCenterStore = globalThis as GlobalEventCenterStore;

/**
 * 获取全局共享事件中心。
 *
 * 使用 Symbol.for 保存实例，确保通过不同 Stencil 打包入口加载时仍能共享同一中心。
 */
export function getGlobalEventCenter(): EventCenter {
  const existingEventCenter = globalEventCenterStore[GLOBAL_EVENT_CENTER_KEY];
  if (existingEventCenter) return existingEventCenter;

  const eventCenter = new EventCenter();
  globalEventCenterStore[GLOBAL_EVENT_CENTER_KEY] = eventCenter;
  return eventCenter;
}

/** 全局共享事件中心实例。 */
export const globalEventCenter = getGlobalEventCenter();
