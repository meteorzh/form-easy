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
import { EventCenter } from '../../managers/event-center';
import { H5BasicFieldRenderer } from '../../renderers/h5-basic-field-renderer';
import type { BasicFieldRenderer } from '../../renderers/basic-field-renderer';
import type { FormChangeDetail, FormSchema } from '../../types';
import {
  validateFormSchema,
  type FormSchemaValidationResult
} from '../../validation/schema';
import creatorSchemaJson from './creator-schema.json';
import {
  createCreatorFormValue,
  mapCreatorValueToSchema,
  mergeCreatorValidationResults,
  type CreatorFormValue
} from './creator-schema-mapper';
import type { FormEasyCreatorChangeDetail } from './types';

/** 驱动设计器配置区域的内部动态表单 schema。 */
const creatorSchema = creatorSchemaJson as FormSchema;

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

/** 使用 form-easy 自身能力可视化创建动态表单 schema。 */
@Component({
  tag: 'form-easy-creator',
  styleUrl: 'form-easy-creator.css'
})
export class FormEasyCreator {
  /** 需要载入设计器继续编辑的现有表单 schema。 */
  @Prop() value?: FormSchema;
  /** 右侧表单预览使用的基础字段渲染器；未传入时使用默认 H5 渲染器。 */
  @Prop() basicFieldRenderer?: BasicFieldRenderer | null;
  /** 设计器生成的 schema 或校验结果变化时触发。 */
  @Event() schemaChange!: EventEmitter<FormEasyCreatorChangeDetail>;
  /** 设计器动态表单当前维护的中间数据。 */
  @State() private creatorFormValue: CreatorFormValue = createCreatorFormValue();
  /** 当前已转换完成的目标表单 schema。 */
  @State() private createdSchema: FormSchema = mapCreatorValueToSchema(
    this.creatorFormValue
  ).schema;
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

  /** 隔离设计器内部字段事件，避免多个实例或业务表单互相影响。 */
  private readonly creatorEventCenter = new EventCenter();
  /** 隔离设计器组件注册，确保始终采用核心包内置 H5 控件。 */
  private readonly creatorRenderer = createCreatorRenderer();
  /** 隔离预览字段事件，避免预览表单和业务表单相互影响。 */
  private readonly previewEventCenter = new EventCenter();
  /** 清除复制反馈所使用的计时器。 */
  private copyStateTimer?: ReturnType<typeof setTimeout>;

  /** 组件首次加载前同步外部传入的待编辑 schema。 */
  componentWillLoad(): void {
    this.loadSchema(this.value);
  }

  /** 组件卸载时清理复制反馈计时器。 */
  disconnectedCallback(): void {
    if (this.copyStateTimer) clearTimeout(this.copyStateTimer);
  }

  /** 外部替换 value 后重新载入设计器。 */
  @Watch('value')
  protected handleValueChange(value?: FormSchema): void {
    this.loadSchema(value);
    this.editorRevision += 1;
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

  /** 校验设计器当前生成的 schema 是否可以安全使用。 */
  @Method()
  async validate(): Promise<boolean> {
    return this.schemaValidation.valid;
  }

  /** 将现有 schema 或默认 schema 转换为设计器可编辑数据。 */
  private loadSchema(schema?: FormSchema): void {
    this.creatorFormValue = createCreatorFormValue(schema);
    this.refreshCreatedSchema(this.creatorFormValue, false);
  }

  /** 接收内部动态表单变更并实时生成目标 schema。 */
  private handleCreatorFormChange = (event: CustomEvent<FormChangeDetail>): void => {
    event.stopPropagation();
    this.creatorFormValue = event.detail.formData;
    this.refreshCreatedSchema(this.creatorFormValue, true);
  };

  /** 转换并校验当前设计数据，可按需向使用方发送变化事件。 */
  private refreshCreatedSchema(value: CreatorFormValue, emitChange: boolean): void {
    const mapping = mapCreatorValueToSchema(value);
    const validation = mergeCreatorValidationResults(
      validateFormSchema(mapping.schema),
      mapping.issues
    );
    this.createdSchema = mapping.schema;
    this.schemaValidation = validation;
    this.previewRevision += 1;
    if (emitChange) {
      this.schemaChange.emit({
        schema: mapping.schema,
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
              设计器本身由动态表单 schema 驱动，左侧修改配置，右侧实时生成并检查 JSON。
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
                <p>字段数组支持增删；复杂递归结构可直接编辑 JSON。</p>
              </div>
            </div>
            <form-easy
              key={`creator-editor-${this.editorRevision}`}
              schema={creatorSchema}
              value={this.creatorFormValue}
              basicFieldRenderer={this.creatorRenderer}
              eventCenter={this.creatorEventCenter}
              onFormChange={this.handleCreatorFormChange}
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
      </section>
    );
  }
}
