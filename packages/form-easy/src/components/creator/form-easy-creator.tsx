import {
  Component,
  Event,
  EventEmitter,
  h,
  Method,
  Prop,
  State,
  Watch
} from '@stencil/core';
import { ComponentDataManager } from '../../managers/component-data-manager';
import { EventCenter } from '../../managers/event-center';
import { waitForNextPaint } from '../../next-paint';
import { H5BasicFieldRenderer } from '../../renderers/h5-basic-field-renderer';
import type { BasicFieldRenderer } from '../../renderers/basic-field-renderer';
import type {
  FormChangeDetail,
  FormLoadingDetail,
  FormReadyDetail,
  FormSchema
} from '../../types';
import {
  supportedRulesByFieldType
} from '../../validation/rule-configuration-validator';
import {
  validateFormSchema,
  type FormSchemaValidationResult
} from '../../validation/schema';
import { areJsonValuesEqual } from '../../value-equality';
import creatorSchemaJson from './creator-schema.json';
import type { FormEasyCreatorChangeDetail } from './types';

/** 设计器动态表单直接维护的目标 Schema 对象。 */
type CreatorFormValue = Record<string, unknown>;

/** 驱动设计器配置区域的内部递归动态表单 schema。 */
const creatorSchema = creatorSchemaJson as FormSchema;

/** 匿名模式下由使用方提供、设计器不显示输入的表单级字段。 */
const anonymousHiddenFieldKeys = new Set(['key', 'name']);

/** 匿名模式使用的配置 schema：不包含表单 key 和表单名的输入。 */
const anonymousCreatorSchema: FormSchema = {
  ...creatorSchema,
  fields: creatorSchema.fields.filter(field =>
    !anonymousHiddenFieldKeys.has(field.key as string))
};

/** 为没有 key 的匿名表单生成默认 key；每次生成都不同，避免多个匿名表单在事件中心里冲突。 */
function generateAnonymousFormKey(): string {
  return `anonymous_${Math.random().toString(36).slice(2, 10).padEnd(8, '0')}`;
}

/** 设计器未传入待编辑 Schema 时使用的初始目标表单。 */
const defaultCreatedSchema: FormSchema = {
  key: 'newForm',
  name: '未命名表单',
  labelPosition: 'left',
  fields: [
    {
      key: 'title',
      name: '标题',
      category: 'basic',
      dataType: 'string',
      required: true,
      componentProperties: {
        placeholder: '请输入标题'
      }
    }
  ]
};

/** 创建仅供设计器内部使用的 H5 基础字段渲染器。 */
function createCreatorRenderer(): H5BasicFieldRenderer {
  const renderer = new H5BasicFieldRenderer();
  renderer.componentRegistry.register('select', {
    tagName: 'form-easy-select'
  });
  renderer.componentRegistry.register('creator-json-editor', {
    tagName: 'form-easy-creator-json-editor'
  });
  return renderer;
}

/** 创建仅供设计器规则类型选项使用的组件数据管理器。 */
function createCreatorComponentDataManager(): ComponentDataManager {
  const manager = new ComponentDataManager();
  manager.register('validation-rule-types', (_context, params) => {
    let category = typeof params.category === 'string'
      ? params.category
      : undefined;
    let dataType = typeof params.dataType === 'string'
      ? params.dataType
      : undefined;
    const reference = typeof params.reference === 'string'
      ? params.reference
      : undefined;
    if (
      reference
      && params.definitions
      && typeof params.definitions === 'object'
      && !Array.isArray(params.definitions)
    ) {
      const definition = (
        params.definitions as Record<string, CreatorFormValue>
      )[reference];
      category = typeof definition?.category === 'string'
        ? definition.category
        : undefined;
      dataType = typeof definition?.dataType === 'string'
        ? definition.dataType
        : undefined;
    }
    const fieldType = category === 'basic' ? dataType : category;
    const supportedRules = fieldType
      ? supportedRulesByFieldType[fieldType]
      : undefined;

    return Array.from(supportedRules ?? []).map(ruleType => ({
      label: ruleType,
      value: ruleType
    }));
  });
  manager.register('creator-definition-options', (_context, params) => {
    if (
      !params.definitions
      || typeof params.definitions !== 'object'
      || Array.isArray(params.definitions)
    ) {
      return [];
    }
    return Object.keys(params.definitions).map(name => ({
      label: name,
      value: name
    }));
  });
  return manager;
}

/** 使用 form-easy 自身能力可视化创建动态表单 schema。 */
@Component({
  tag: 'form-easy-creator',
  styleUrl: 'form-easy-creator.css'
})
export class FormEasyCreator {
  /** 需要载入设计器继续编辑的现有表单 schema。 */
  @Prop()
  get value(): FormSchema | undefined {
    return this.storedValue;
  }
  set value(next: FormSchema | undefined) {
    // Stencil 在写入后会回读一次并再次调用 setter，这里直接忽略回读。
    if (next === this.storedValue) return;
    // 载入期间表单结构必须保持稳定，否则设计器会丢失当前编辑进度。
    if (this.schemaLoading) {
      console.error(
        `设计器正在载入表单“${this.loadingFormKey}”，此时不能修改 value。` +
        '请等待 formReady 事件发出后再设置新的表单配置。'
      );
      return;
    }
    this.storedValue = next;
    this.requestLoad();
  }
  /**
   * 是否以匿名模式编辑表单。
   *
   * 匿名模式下不显示表单 key 和表单名的输入：沿用传入 value 的 key，
   * 没有 key 时自动生成一个默认 key；传入的 name 原样保留在输出中。载入期间不能切换模式。
   */
  @Prop()
  get anonymous(): boolean {
    return this.storedAnonymous;
  }
  set anonymous(next: boolean) {
    const anonymous = next === true;
    if (anonymous === this.storedAnonymous) return;
    if (this.schemaLoading) {
      console.error(
        `设计器正在载入表单“${this.loadingFormKey}”，此时不能切换匿名模式。` +
        '请等待 formReady 事件发出后再切换。'
      );
      return;
    }
    // 首次挂载前只记录模式，由生命周期按最终的 value 统一载入。
    if (!this.mounted) {
      this.storedAnonymous = anonymous;
      return;
    }
    // 切换模式时沿用当前编辑结果；切到匿名模式时当前没有 key 会自动生成。
    this.storedAnonymous = anonymous;
    this.rebuildEditor(this.createdSchema);
  }
  /** 右侧表单预览使用的基础字段渲染器；未传入时使用默认 H5 渲染器。 */
  @Prop() basicFieldRenderer?: BasicFieldRenderer | null;
  /** 设计器生成的 schema 或校验结果变化时触发。 */
  @Event() schemaChange!: EventEmitter<FormEasyCreatorChangeDetail>;
  /** 设计器按新 value 开始重新载入时触发；载入期间的修改会被忽略。 */
  @Event() formLoading!: EventEmitter<FormLoadingDetail>;
  /** 设计器载入完成、可以接受新的表单配置时触发，与 formLoading 成对出现。 */
  @Event() formReady!: EventEmitter<FormReadyDetail>;
  /** 设计器动态表单直接维护的目标 Schema 数据。 */
  @State() private creatorFormValue: CreatorFormValue = (
    defaultCreatedSchema as unknown as CreatorFormValue
  );
  /** 当前设计器直接输出的目标表单 Schema。 */
  @State() private createdSchema: FormSchema = defaultCreatedSchema;
  /** 当前目标表单 schema 的完整静态校验结果。 */
  @State() private schemaValidation: FormSchemaValidationResult = validateFormSchema(
    this.createdSchema
  );
  /** 用于在外部 value 变化时重建内部动态表单。 */
  @State() private editorRevision = 0;
  /** 复制操作的短暂反馈状态。 */
  @State() private copyState: 'idle' | 'success' | 'error' = 'idle';
  /** 右侧检查区域当前展示的内容。 */
  @State() private outputMode: 'schema' | 'preview' = 'schema';
  /** 生成 schema 或预览渲染器变化时用于重建预览表单。 */
  @State() private previewRevision = 0;
  /** 当前是否正在按新 value 重新载入设计器。 */
  @State() private schemaLoading = false;
  /** 当前 loading 会话对应的表单键。 */
  private loadingFormKey = '';
  /** 载入工作循环是否正在运行。 */
  private loadWorkerRunning = false;
  /** 当前生效的待编辑 schema。 */
  private storedValue?: FormSchema;
  /** 组件是否已经完成首次挂载。 */
  private mounted = false;
  /** componentWillLoad 载入时使用的 value，用来发现两个生命周期之间才写入的 value。 */
  private initialLoadedValue?: FormSchema;
  /** 当前是否处于匿名模式。 */
  private storedAnonymous = false;
  /**
   * 使用方当前持有的 schema：载入时为传入的 value，之后为最近一次发出的结果。
   * 只有生成结果与它不同时才发出 schemaChange。
   */
  private reportedSchema?: unknown;
  /** 匿名模式下合并回输出的表单 key 和 name；key 来自传入的 value 或自动生成。 */
  private anonymousIdentity?: Pick<FormSchema, 'key' | 'name'>;

  /** 隔离设计器内部字段事件，避免多个实例或业务表单互相影响。 */
  private readonly creatorEventCenter = new EventCenter();
  /** 隔离设计器组件注册，确保始终采用核心包内置 H5 控件。 */
  private readonly creatorRenderer = createCreatorRenderer();
  /** 隔离设计器内部规则选项的数据解析器。 */
  private readonly creatorComponentDataManager = createCreatorComponentDataManager();
  /** 隔离预览字段事件，避免预览表单和业务表单相互影响。 */
  private readonly previewEventCenter = new EventCenter();
  /** 清除复制反馈所使用的计时器。 */
  private copyStateTimer?: ReturnType<typeof setTimeout>;
  /** 当前用于编辑 Schema 的内部动态表单元素。 */
  private creatorFormElement?: HTMLElement & {
    /** 主动拉取并校验内部全部字段。 */
    validate(): Promise<boolean>;
  };

  /** 组件首次加载前同步外部传入的待编辑 schema。 */
  componentWillLoad(): void {
    this.initialLoadedValue = this.value;
    this.loadSchema(this.value);
  }

  /** 组件挂载完成后才允许响应外部的 value 变更。 */
  componentDidLoad(): void {
    this.mounted = true;
    // 组件代码已缓存时，componentWillLoad 可能先于使用方写入 value 执行，
    // value 在两个生命周期之间写入时 requestLoad 还不会响应，这里补一次载入。
    if (this.value !== this.initialLoadedValue) this.requestLoad();
    this.initialLoadedValue = undefined;
  }

  /** 组件卸载时清理复制反馈计时器。 */
  disconnectedCallback(): void {
    if (this.copyStateTimer) clearTimeout(this.copyStateTimer);
  }

  /** 判断 schema 是否带有可用的表单 key。 */
  private hasFormKey(schema?: FormSchema): boolean {
    return typeof schema?.key === 'string' && schema.key.trim() !== '';
  }

  /** 提取匿名模式下需要保留的表单 key 和 name；没有 key 时生成默认 key。 */
  private pickIdentity(schema?: FormSchema): Pick<FormSchema, 'key' | 'name'> {
    const key = this.hasFormKey(schema) ? schema!.key : generateAnonymousFormKey();
    return schema?.name === undefined ? { key } : { key, name: schema.name };
  }

  /**
   * 切换模式后用指定 schema 重建配置区，保留当前编辑进度。
   *
   * 只是换了一份配置界面，不属于载入新的表单配置，因此不发出 formLoading 和 formReady。
   */
  private rebuildEditor(schema?: FormSchema): void {
    this.loadSchema(schema);
    this.editorRevision += 1;
  }

  /** 安排一次设计器载入。 */
  private requestLoad(): void {
    // 首次挂载由生命周期直接载入，不进入 loading。
    if (!this.mounted) return;
    this.beginSchemaLoading(this.resolveTargetKey(this.value));
    this.ensureLoadWorker();
  }

  /** 计算载入目标对应的表单键。 */
  private resolveTargetKey(value?: FormSchema): string {
    return value?.key ?? this.createdSchema.key;
  }

  /** 进入 loading 状态并发出 formLoading。 */
  private beginSchemaLoading(formKey: string): void {
    if (this.schemaLoading) {
      // 载入目标换了表单时，先结束旧会话再开新会话，
      // 保证 formLoading 和 formReady 始终成对且指向同一个表单。
      if (this.loadingFormKey === formKey) return;
      this.endSchemaLoading();
    }
    this.loadingFormKey = formKey;
    this.schemaLoading = true;
    this.formLoading.emit({ formKey });
  }

  /** 结束 loading 状态并发出 formReady，此后设计器可以接受新的配置。 */
  private endSchemaLoading(): void {
    if (!this.schemaLoading) return;
    this.schemaLoading = false;
    this.formReady.emit({ formKey: this.loadingFormKey });
  }

  /** 启动载入工作循环；已有循环在运行时直接复用。 */
  private ensureLoadWorker(): void {
    if (this.loadWorkerRunning) return;
    this.loadWorkerRunning = true;
    void this.runLoadWorker();
  }

  /**
   * 载入最新的 value。
   *
   * 每次载入前先让出一帧，保证 loading 蒙层先绘制出来；
   * 载入完成后发出 formReady，提示调用者设计器已经可以接受新的配置。
   */
  private async runLoadWorker(): Promise<void> {
    try {
      await waitForNextPaint();
      this.loadSchema(this.value);
      this.editorRevision += 1;
      // 数据落地后再等一帧再收起蒙层，避免蒙层和内容更新落在同一帧被跳过。
      await waitForNextPaint();
    } finally {
      // 必须先结束工作循环，再收起蒙层并发出 formReady（出错时同样收起蒙层）。
      // 监听器收到 formReady 时设计器已完全空闲，此时发起的修改是合法修改，
      // 要能正常开启新一轮载入，不能被静默丢弃。
      this.loadWorkerRunning = false;
      this.endSchemaLoading();
    }
  }

  /** 外部切换预览渲染器后重建预览表单。 */
  @Watch('basicFieldRenderer')
  protected handleRendererChange(): void {
    this.previewRevision += 1;
  }

  /** 获取设计器当前生成的表单 schema。 */
  @Method()
  async getSchema(): Promise<FormSchema> {
    return this.createdSchema;
  }

  /** 获取设计器当前 schema 的静态校验结果。 */
  @Method()
  async getSchemaValidationResult(): Promise<FormSchemaValidationResult> {
    return this.schemaValidation;
  }

  /**
   * 获取驱动设计器界面的内置 schema。
   *
   * 该 schema 覆盖基础、对象、数组、record、definitions 引用和绑定等能力，
   * 可作为复杂表单配置的参考示例。
   */
  @Method()
  async getDesignerSchema(): Promise<FormSchema> {
    return creatorSchema;
  }

  /** 校验设计器当前生成的 schema 是否可以安全使用。 */
  @Method()
  async validate(): Promise<boolean> {
    const editorValid = await this.creatorFormElement?.validate() ?? true;
    return editorValid && this.schemaValidation.valid;
  }

  /** 将现有 Schema 或默认 Schema 直接载入设计器动态表单。 */
  private loadSchema(schema?: FormSchema): void {
    // 载入后配置区会规范化这份 schema（匿名模式还可能生成 key），结果与它不同时再发出 schemaChange。
    this.reportedSchema = schema;
    if (this.storedAnonymous) {
      // 匿名模式没有 key 和 name 的输入，不使用带示例名称的默认表单；未传入时从空表单开始。
      this.anonymousIdentity = this.pickIdentity(schema);
      // 配置区的值带上完整的 key 和 name：它们不在匿名配置 schema 中，配置区载入后总会上报一次，
      // 由设计器比较后决定是否需要发出 schemaChange（例如生成了默认 key）。
      this.creatorFormValue = this.composeSchema(
        (schema ?? { fields: [] }) as unknown as CreatorFormValue
      );
      this.refreshCreatedSchema(this.creatorFormValue, false);
      return;
    }
    this.creatorFormValue = (
      schema ?? defaultCreatedSchema
    ) as unknown as CreatorFormValue;
    this.refreshCreatedSchema(this.creatorFormValue, false);
  }

  /** 匿名模式下把使用方提供的 key 和 name 合并回配置区输出的 schema。 */
  private composeSchema(formData: CreatorFormValue): CreatorFormValue {
    if (!this.storedAnonymous || !this.anonymousIdentity) return formData;
    // key 和 name 只以记录的值为准，载入数据里的空 key 不能覆盖生成的默认 key。
    const { key: _key, name: _name, ...rest } = formData;
    return { ...this.anonymousIdentity, ...rest };
  }

  /** 内部动态表单的事件只在设计器内部使用，不能冒泡到设计器宿主，避免和设计器自身的事件混淆。 */
  private stopInnerFormEvent = (event: Event): void => {
    event.stopPropagation();
  };

  /** 接收内部动态表单直接输出的目标 Schema。 */
  private handleCreatorFormChange = (event: CustomEvent<FormChangeDetail>): void => {
    event.stopPropagation();
    // 每次载入都会重建内部表单；已被替换的旧表单仍可能在自身加载结束后补发 formChange，
    // 这些旧数据不能覆盖当前载入的 schema。
    if (event.currentTarget !== this.creatorFormElement) return;
    // 只更新对外 schema。把省略 optional 字段后的输出再写回 value，
    // 会让这些字段的存在状态在 true/false 之间来回翻转。
    const schema = this.composeSchema(event.detail.formData);
    // 内容没有变化的输出（例如配置区载入完成后的上报）不再打扰使用方。
    const changed = !areJsonValuesEqual(schema, this.reportedSchema);
    this.reportedSchema = schema;
    this.refreshCreatedSchema(schema, changed);
  };

  /** 校验当前设计数据，并按需向使用方发送变化事件。 */
  private refreshCreatedSchema(value: CreatorFormValue, emitChange: boolean): void {
    const schema = value as unknown as FormSchema;
    const validation = validateFormSchema(value);
    this.createdSchema = schema;
    this.schemaValidation = validation;
    this.previewRevision += 1;
    if (emitChange) {
      this.schemaChange.emit({
        schema,
        validation
      });
    }
  }

  /** 将当前 schema 的格式化 JSON 写入系统剪贴板。 */
  private copySchema = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(this.formattedSchema);
      this.updateCopyState('success');
    } catch (error) {
      console.error('复制 form-easy schema 失败。', error);
      this.updateCopyState('error');
    }
  };

  /** 更新复制反馈，并在短暂展示后恢复默认状态。 */
  private updateCopyState(state: 'success' | 'error'): void {
    if (this.copyStateTimer) clearTimeout(this.copyStateTimer);
    this.copyState = state;
    this.copyStateTimer = setTimeout(() => {
      this.copyState = 'idle';
    }, 1800);
  }

  /** 获取适合展示与复制的格式化 schema JSON。 */
  private get formattedSchema(): string {
    return JSON.stringify(this.createdSchema, null, 2);
  }

  /** 切换右侧 schema 或表单预览模式。 */
  private changeOutputMode = (mode: 'schema' | 'preview'): void => {
    this.outputMode = mode;
  };

  /** 渲染当前 schema 对应的实时动态表单预览。 */
  private renderFormPreview() {
    if (!this.schemaValidation.valid) {
      return (
        <div class="creator-preview-unavailable" role="alert">
          <strong>暂时无法预览</strong>
          <p>请先修复 schema 中的错误，避免使用无效配置挂载动态表单。</p>
        </div>
      );
    }
    return (
      <div class="creator-form-preview">
        <form-easy
          key={`creator-preview-${this.previewRevision}`}
          schema={this.createdSchema}
          basicFieldRenderer={this.basicFieldRenderer ?? null}
          eventCenter={this.previewEventCenter}
          onFormChange={this.stopInnerFormEvent}
          onFormLoading={this.stopInnerFormEvent}
          onFormReady={this.stopInnerFormEvent}
        />
      </div>
    );
  }

  /** 渲染 schema 校验问题列表。 */
  private renderValidationIssues() {
    if (this.schemaValidation.issues.length === 0) {
      return <p class="creator-empty-state">当前 schema 结构完整，可以直接使用。</p>;
    }
    return (
      <ul class="creator-issues">
        {this.schemaValidation.issues.map((issue, index) => (
          <li class={`creator-issue creator-issue--${issue.level}`} key={`${issue.path}-${index}`}>
            <span>{issue.level === 'error' ? '错误' : '警告'}</span>
            <div>
              <code>{issue.path}</code>
              <p>{issue.message}</p>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  /** 渲染设计器配置工作区和实时 schema 检查器。 */
  render() {
    const validationStatus = this.schemaValidation.valid ? 'valid' : 'invalid';
    const copyLabel = this.copyState === 'success'
      ? '已复制'
      : this.copyState === 'error'
        ? '复制失败'
        : '复制 JSON';

    return (
      <section class="creator-shell">
        <header class="creator-header">
          <div>
            <p class="creator-eyebrow">FORM EASY / CREATOR</p>
            <h1>可视化表单设计器</h1>
            <p class="creator-description">
              维护字段与 definitions 引用，左侧修改配置，右侧实时生成并检查 JSON。
            </p>
          </div>
          <div class={`creator-status creator-status--${validationStatus}`} role="status">
            <i aria-hidden="true"></i>
            {this.schemaValidation.valid
              ? 'Schema 可用'
              : `${this.schemaValidation.errors.length} 个错误`}
          </div>
        </header>

        <div class="creator-workbench">
          <section class="creator-editor" aria-label="表单配置编辑器">
            <div class="creator-section-heading">
              <span>01</span>
              <div>
                <h2>配置表单</h2>
                <p>字段支持内联配置或引用 definitions，引用目标不会递归展开。</p>
              </div>
            </div>
            <form-easy
              ref={(element?: typeof this.creatorFormElement) => {
                // 重建内部表单时新旧元素的 ref 回调顺序不固定，只记录新挂载的元素。
                if (element) this.creatorFormElement = element;
              }}
              key={`creator-editor-${this.editorRevision}`}
              schema={this.storedAnonymous ? anonymousCreatorSchema : creatorSchema}
              value={this.creatorFormValue}
              showLoadingOverlay={false}
              basicFieldRenderer={this.creatorRenderer}
              componentDataManager={this.creatorComponentDataManager}
              eventCenter={this.creatorEventCenter}
              onFormChange={this.handleCreatorFormChange}
              onFormLoading={this.stopInnerFormEvent}
              onFormReady={this.stopInnerFormEvent}
            />
          </section>

          <aside class="creator-output" aria-label="生成结果">
            <div class="creator-output-heading">
              <div>
                <span>02 / OUTPUT</span>
                <h2>{this.outputMode === 'schema' ? '生成的 Schema' : '动态表单预览'}</h2>
              </div>
              {this.outputMode === 'schema' ? (
                <button type="button" onClick={this.copySchema}>{copyLabel}</button>
              ) : null}
            </div>
            <nav class="creator-output-modes" aria-label="输出查看模式">
              <button
                type="button"
                class={{ active: this.outputMode === 'schema' }}
                aria-pressed={this.outputMode === 'schema' ? 'true' : 'false'}
                onClick={() => this.changeOutputMode('schema')}
              >
                JSON Schema
              </button>
              <button
                type="button"
                class={{ active: this.outputMode === 'preview' }}
                aria-pressed={this.outputMode === 'preview' ? 'true' : 'false'}
                onClick={() => this.changeOutputMode('preview')}
              >
                表单预览
              </button>
            </nav>
            <div class="creator-output-content">
              {this.outputMode === 'schema' ? (
                <pre tabindex="0"><code>{this.formattedSchema}</code></pre>
              ) : this.renderFormPreview()}
            </div>
            <div class="creator-validation">
              <div class="creator-validation-heading">
                <h3>结构检查</h3>
                <span>
                  {this.schemaValidation.errors.length} errors ·{' '}
                  {this.schemaValidation.warnings.length} warnings
                </span>
              </div>
              {this.renderValidationIssues()}
            </div>
          </aside>
        </div>
        {this.schemaLoading ? (
          <div class="creator-loading" role="status" aria-live="polite" />
        ) : null}
        {this.schemaLoading ? (
          <div class="creator-loading-indicator">
            <span>正在载入表单配置…</span>
          </div>
        ) : null}
      </section>
    );
  }
}
