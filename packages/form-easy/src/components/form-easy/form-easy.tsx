import {
  Component,
  Element,
  Event,
  EventEmitter,
  h,
  Listen,
  Method,
  Prop,
  State,
  Watch
} from '@stencil/core';
import { globalEventCenter, type EventCenter } from '../../managers/event-center';
import type { ComponentDataManager } from '../../managers/component-data-manager';
import type { EndpointManager } from '../../managers/endpoint-manager';
import {
  FormValueStore,
  synchronizeFormFieldValue
} from '../../managers/form-value-store';
import {
  resolveFormFieldNode,
  type FormFieldDefinitions
} from '../../form-field-definition-resolver';
import type { BasicFieldRenderer } from '../../renderers/basic-field-renderer';
import {
  createFormOutputData
} from '../../form-field-output';
import type {
  FieldPresenceChangeDetail,
  FieldVisibilityChangeDetail,
  FormChangeDetail,
  FormField,
  FormFieldNode,
  FormSchema,
  LabelPosition
} from '../../types';

/** 根据 JSON schema 渲染完整动态表单。 */
@Component({
  tag: 'form-easy',
  styleUrl: 'form-easy.css'
})
export class FormEasy {
  /** 当前 form-easy 自定义元素。 */
  @Element() hostElement!: HTMLElement;
  /** 描述表单及其字段的 JSON schema。 */
  @Prop() schema!: FormSchema;
  /** 初始化完成后加载的表单预设值。 */
  @Prop() value?: Record<string, unknown>;
  /**
   * 当前表单的基础字段渲染器。
   * undefined 使用全局渲染器，null 强制使用默认 H5 渲染。
   */
  @Prop() basicFieldRenderer?: BasicFieldRenderer | null;
  /**
   * 当前表单使用的事件中心。
   * 未传入时使用全局共享事件中心；传入后可与其他表单隔离。
   */
  @Prop() eventCenter?: EventCenter;
  /** 当前表单覆盖全局配置的组件数据管理器。 */
  @Prop() componentDataManager?: ComponentDataManager;
  /** 当前表单覆盖全局配置的异步服务端点管理器。 */
  @Prop() endpointManager?: EndpointManager;
  /** 当前表单使用的字段值存储；未传入时为当前表单创建独立实例。 */
  @Prop() formValueStore?: FormValueStore;
  /** 表单允许渲染的最大字段嵌套深度。 */
  @Prop() maxRenderDepth = 32;
  /** 每次值变更时触发字段和完整表单上下文。 */
  @Event() formChange!: EventEmitter<FormChangeDetail>;
  /** 当前完整表单数据。 */
  @State() private formData: Record<string, unknown> = {};
  /** 当前表单未传入外部字段值存储时使用的内部实例。 */
  private readonly internalFormValueStore = new FormValueStore();
  /** 按字段完整唯一标识保存当前可见状态。 */
  private readonly fieldVisibility = new Map<string, boolean>();
  /** 按字段完整唯一标识保存 optional 字段当前的输出存在状态。 */
  private readonly fieldPresence = new Map<string, boolean>();
  /** 标记初始表单数据是否已经完成加载。 */
  private initialized = false;

  /** 当前表单生效的字段标签位置。 */
  private get labelPosition(): LabelPosition {
    return this.schema.labelPosition ?? 'left';
  }

  /** 获取当前表单实际使用的事件中心。 */
  private get activeEventCenter(): EventCenter {
    return this.eventCenter ?? globalEventCenter;
  }

  /** 获取当前表单实际使用的字段值存储。 */
  private get activeFormValueStore(): FormValueStore {
    return this.formValueStore ?? this.internalFormValueStore;
  }

  /** 获取当前 schema 声明的可复用字段定义。 */
  private get fieldDefinitions(): FormFieldDefinitions {
    return this.schema.definitions ?? {};
  }

  /** 初始化第一阶段：挂载控件时先提供空表单数据。 */
  componentWillLoad(): void {
    this.formData = {};
  }

  /** 初始化第二阶段：按预设值或默认值写入字段数据。 */
  componentDidLoad(): void {
    this.initializeFormData();
  }

  @Watch('schema')
  reloadSchema(): void {
    if (!this.isSchemaReady()) return;
    this.initialized = false;
    this.fieldVisibility.clear();
    this.fieldPresence.clear();
    this.initializeFormData();
  }

  @Watch('value')
  reloadValue(): void {
    if (!this.isSchemaReady()) return;
    const nextData = this.value === undefined
      ? this.createDefaultFormData(this.schema.fields)
      : this.createPresetFormData(this.schema.fields, this.value, 0);
    if (this.initialized && this.areValuesEqual(nextData, this.formData)) return;
    this.applyFormData(nextData);
  }

  /** 校验表单中当前挂载的全部字段，并返回是否全部通过。 */
  @Method()
  async validate(): Promise<boolean> {
    const fields = this.getRenderedFieldElements();
    const results = await Promise.all(fields.map(field => field.validate()));
    return results.every(Boolean);
  }

  /** 根据完整字段标识校验一个当前已挂载的字段。 */
  @Method()
  async validateField(fieldId: string): Promise<boolean> {
    const field = this.getRenderedFieldElements()
      .find(fieldElement => fieldElement.fieldId === fieldId);
    if (!field) throw new Error(`未找到字段“${fieldId}”。`);
    return field.validate();
  }

  /** 获取当前表单中包含嵌套结构的全部字段元素。 */
  private getRenderedFieldElements(): Array<HTMLElement & {
    /** 字段完整唯一标识。 */
    fieldId: string;
    /** 执行字段同步规则校验。 */
    validate(): Promise<boolean>;
  }> {
    return Array.from(this.hostElement.querySelectorAll('form-easy-field')) as Array<HTMLElement & {
      fieldId: string;
      validate(): Promise<boolean>;
    }>;
  }
  /** 顶层字段触发新值后更新该字段。 */
  private changeField = (
    field: FormField,
    fieldId: string,
    event: CustomEvent<unknown>
  ): void => {
    event.stopPropagation();
    this.formData = { ...this.formData, [field.key!]: event.detail };
    this.emitFormChange(fieldId, event.detail);
  };

  /** 字段显示或隐藏后更新运行时可见状态并重新生成表单输出。 */
  @Listen('fieldVisibilityChange')
  handleFieldVisibilityChange(
    event: CustomEvent<FieldVisibilityChangeDetail>
  ): void {
    event.stopPropagation();
    const detail = event.detail;
    if (detail.connected) {
      this.fieldVisibility.set(detail.fieldId, detail.visible);
    } else {
      this.fieldVisibility.delete(detail.fieldId);
    }
    if (!this.initialized || !detail.affectsOutput) return;
    this.emitFormChange(
      detail.fieldId,
      this.activeFormValueStore.getValue(detail.fieldId)
    );
  }

  /** optional 字段存在状态变化后重新生成表单输出。 */
  @Listen('fieldPresenceChange')
  handleFieldPresenceChange(
    event: CustomEvent<FieldPresenceChangeDetail>
  ): void {
    event.stopPropagation();
    const detail = event.detail;
    if (detail.connected) {
      this.fieldPresence.set(detail.fieldId, detail.present);
    } else {
      this.fieldPresence.delete(detail.fieldId);
    }
    if (!this.initialized) return;
    this.emitFormChange(
      detail.fieldId,
      this.activeFormValueStore.getValue(detail.fieldId)
    );
  }

  /** 发送保留原始字段值、但按输出策略过滤后的表单变化事件。 */
  private emitFormChange(fieldId: string, value: unknown): void {
    this.formChange.emit({
      fieldId,
      value,
      formData: createFormOutputData(
        this.schema.fields,
        this.formData,
        this.schema.key,
        {
          definitions: this.fieldDefinitions,
          maxDepth: this.maxRenderDepth,
          isFieldVisible: currentFieldId =>
            this.fieldVisibility.get(currentFieldId) ?? true,
          isFieldPresent: currentFieldId =>
            this.fieldPresence.get(currentFieldId) ?? true
        }
      )
    });
  }

  /** 写入完整表单数据，并为每一个字段发布 onChange 初始化事件。 */
  private applyFormData(formData: Record<string, unknown>): void {
    this.formData = formData;
    this.schema.fields.forEach(fieldNode => {
      const field = this.resolveField(fieldNode);
      if (!field) return;
      if (!field.key) return;
      synchronizeFormFieldValue(
        this.activeFormValueStore,
        field,
        `${this.schema.key}.${field.key}`,
        formData[field.key],
        this.fieldDefinitions,
        this.maxRenderDepth
      );
    });
    this.initialized = true;
    this.publishInitialFieldValues(this.schema.fields, this.schema.key, formData);
  }

  /** 根据字段定义构造默认表单数据；无默认值的基础和数组字段为 null。 */
  private createDefaultFormData(fields: FormFieldNode[]): Record<string, unknown> {
    return Object.fromEntries(
      fields
        .map(fieldNode => this.resolveField(fieldNode))
        .filter((field): field is FormField => Boolean(field?.key))
        .filter(field => field.optional !== true)
        .map(field => [field.key!, this.createDefaultFieldValue(field)])
    );
  }

  /** 根据预设值构造完整表单数据；预设中缺失的字段一律为 null。 */
  private createPresetFormData(
    fields: FormFieldNode[],
    presetData: Record<string, unknown>,
    depth: number
  ): Record<string, unknown> {
    return Object.fromEntries(
      fields
        .map(fieldNode => this.resolveField(fieldNode))
        .filter((field): field is FormField => Boolean(field?.key))
        .flatMap(field => {
          const hasPresetValue = Object.prototype.hasOwnProperty.call(presetData, field.key!);
          if (field.optional === true && !hasPresetValue) return [];
          const presetValue = hasPresetValue ? presetData[field.key!] : null;
          const value = this.createPresetFieldValue(field, presetValue, depth);
          return [[field.key!, value] as const];
        })
    );
  }

  /** 根据字段分类规范化单个预设值。 */
  private createPresetFieldValue(
    field: FormField,
    presetValue: unknown,
    depth: number
  ): unknown {
    if (depth >= this.maxRenderDepth) return this.cloneValue(presetValue);
    if (field.category === 'object') {
      return this.isRecord(presetValue)
        ? this.createPresetFormData(field.fields ?? [], presetValue, depth + 1)
        : null;
    }
    if (field.category === 'record') {
      return this.createPresetRecordValue(field, presetValue, depth);
    }
    if (field.category === 'array' && Array.isArray(presetValue)) {
      return presetValue.map(item => this.createPresetArrayElementValue(
        field,
        item,
        depth + 1
      ));
    }
    return presetValue === undefined ? null : this.cloneValue(presetValue);
  }

  /** 根据统一 value 定义规范化 record 字段的每一个动态属性值。 */
  private createPresetRecordValue(
    field: FormField,
    presetValue: unknown,
    depth: number
  ): Record<string, unknown> | null {
    if (!this.isRecord(presetValue)) return null;
    const valueField = field.kvDef
      ? this.resolveField(field.kvDef.value)
      : undefined;
    if (!valueField) return this.cloneValue(presetValue) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(presetValue).map(([key, value]) => [
        key,
        this.createPresetFieldValue(valueField, value, depth + 1)
      ])
    );
  }

  /** 根据数组元素定义规范化对象元素中的预设子字段。 */
  private createPresetArrayElementValue(
    field: FormField,
    presetValue: unknown,
    depth: number
  ): unknown {
    if (depth >= this.maxRenderDepth) return this.cloneValue(presetValue);
    const element = field.element
      ? this.resolveField(field.element)
      : undefined;
    if (element?.category === 'object') {
      return this.isRecord(presetValue)
        ? this.createPresetFormData(
          element.fields ?? [],
          presetValue,
          depth + 1
        )
        : null;
    }
    return presetValue === undefined ? null : this.cloneValue(presetValue);
  }

  /** 根据 defaultValue 配置构造字段默认值；未配置时统一返回 null。 */
  private createDefaultFieldValue(field: FormField): unknown {
    if (Object.prototype.hasOwnProperty.call(field, 'defaultValue')) {
      return this.createPresetFieldValue(field, field.defaultValue, 0);
    }
    return null;
  }

  /** 判断 schema 是否已经具备可初始化表单的最小结构。 */
  private isSchemaReady(): boolean {
    return Boolean(this.schema && Array.isArray(this.schema.fields));
  }

  /** 在 schema 和自定义元素生命周期均就绪后初始化当前表单。 */
  private initializeFormData(): void {
    if (!this.isSchemaReady()) return;
    const initialData = this.value === undefined
      ? this.createDefaultFormData(this.schema.fields)
      : this.createPresetFormData(this.schema.fields, this.value, 0);
    this.applyFormData(initialData);
  }

  /** 比较规范化后的表单值，避免 v-model 回写触发重复初始化。 */
  private areValuesEqual(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) return true;
    if (Array.isArray(left) || Array.isArray(right)) {
      if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
        return false;
      }
      return left.every((value, index) => this.areValuesEqual(value, right[index]));
    }
    if (this.isRecord(left) || this.isRecord(right)) {
      if (!this.isRecord(left) || !this.isRecord(right)) return false;
      const leftKeys = Object.keys(left);
      const rightKeys = Object.keys(right);
      if (leftKeys.length !== rightKeys.length) return false;
      return leftKeys.every(key => (
        Object.prototype.hasOwnProperty.call(right, key)
        && this.areValuesEqual(left[key], right[key])
      ));
    }
    return false;
  }

  /** 深复制 JSON 结构的数组或对象值。 */
  private cloneValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(item => this.cloneValue(item));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [
          key,
          this.cloneValue(item)
        ])
      );
    }
    return value;
  }

  /** 判断值是否为可合并的普通对象记录。 */
  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  /** 发布顶层字段的 onChange 事件；嵌套值由对应对象和数组容器继续发布。 */
  private publishInitialFieldValues(
    fields: FormFieldNode[],
    parentFieldId: string,
    data: Record<string, unknown>
  ): void {
    fields.forEach(fieldNode => {
      const field = this.resolveField(fieldNode);
      if (!field) return;
      if (!field.key) return;

      const fieldId = `${parentFieldId}.${field.key}`;
      const fieldValue = data[field.key] ?? null;
      this.activeEventCenter.publish(fieldId, 'onChange', fieldValue);
    });
  }

  /** 使用当前 schema definitions 浅解析一个字段节点。 */
  private resolveField(fieldNode: FormFieldNode): FormField | undefined {
    return resolveFormFieldNode(fieldNode, this.fieldDefinitions);
  }

  /** 渲染表单标题和全部顶层字段渲染器。 */
  render() {
    const schema = this.schema;
    const fields = Array.isArray(schema?.fields) ? schema.fields : [];
    const hasFormName = typeof schema?.name === 'string'
      && schema.name.trim().length > 0;

    return (
      <form part="form" novalidate>
        {hasFormName ? <h2>{schema.name}</h2> : null}
        {fields.map(fieldNode => {
          const field = this.resolveField(fieldNode);
          if (!field) {
            const referenceName = '$ref' in fieldNode
              ? fieldNode.$ref
              : '未知定义';
            return (
              <p class="form-schema-error" role="alert">
                未找到字段定义：{referenceName}。
              </p>
            );
          }
          if (!field.key) return null;
          return (
            <form-easy-field
              field={field}
              fieldId={`${schema.key}.${field.key}`}
              formKey={schema.key}
              labelPosition={this.labelPosition}
              basicFieldRenderer={this.basicFieldRenderer}
              componentDataManager={this.componentDataManager}
              endpointManager={this.endpointManager}
              value={this.formData[field.key]}
              valuePresent={Object.prototype.hasOwnProperty.call(
                this.formData,
                field.key
              )}
              eventCenter={this.activeEventCenter}
              formValueStore={this.activeFormValueStore}
              fieldDefinitions={this.fieldDefinitions}
              renderDepth={0}
              maxRenderDepth={this.maxRenderDepth}
              onValueChange={(event: CustomEvent<unknown>) =>
                this.changeField(field, `${schema.key}.${field.key}`, event)
              }
            />
          );
        })}
      </form>
    );
  }
}
