import type {
  ComponentEventName,
  ComponentHandle,
  EventFlowHistory,
  HandleTarget
} from '../types';

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

  /** 添加事件订阅并返回清理函数。 */
  subscribe(sourceFieldId: string, eventName: ComponentEventName, target: HandleTarget, handle: ComponentHandle): () => void {
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
