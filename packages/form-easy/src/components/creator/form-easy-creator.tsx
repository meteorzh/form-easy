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
import { H5BasicFieldRenderer } from '../../renderers/h5-basic-field-renderer';
import type { BasicFieldRenderer } from '../../renderers/basic-field-renderer';
import {
  isFormFieldReference,
  resolveFormFieldNode
} from '../../form-field-definition-resolver';
import type {
  FormChangeDetail,
  FormField,
  FormFieldDefinition,
  FormFieldNode,
  FormSchema
} from '../../types';
import {
  supportedRulesByFieldType
} from '../../validation/rule-configuration-validator';
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

/** 设计器内部用于编辑完整字段配置的 definitions 名称。 */
const FIELD_DEFINITION_NAME = 'fieldDefinition';
/** 设计器内部用于编辑匿名数组元素配置的 definitions 名称。 */
const ARRAY_ELEMENT_DEFINITION_NAME = 'arrayElementDefinition';

/** 引用节点 required 覆盖使用的三态选项。 */
const REQUIRED_OVERRIDE_OPTIONS = [
  { label: '继承定义', value: 'inherit' },
  { label: '必填', value: 'true' },
  { label: '非必填', value: 'false' }
];

/**
 * 从 JSON 中的顶层字段编辑器模板构建设计器递归 definitions。
 *
 * 匿名数组元素模板会移除字段 key 和字段名称控件，其余配置继续与完整
 * 字段模板共享同一种递归结构。
 */
function createCreatorSchema(): FormSchema {
  const schema = JSON.parse(JSON.stringify(creatorSchemaJson)) as FormSchema;
  const fieldDefinitionsField = findCreatorSchemaField(schema, 'fieldDefinitions');
  const schemaDefinitionsField = findCreatorSchemaField(schema, 'schemaDefinitions');
  const element = fieldDefinitionsField?.element;
  if (!element || isFormFieldReference(element)) {
    throw new Error('设计器 schema 缺少字段配置编辑器模板。');
  }

  const originalFieldDefinition = element as FormFieldDefinition;
  const inlineDefinitionFields = addRecordDefinitionEditor(
    removeIdentityEditorFields(originalFieldDefinition),
    originalFieldDefinition
  );
  const anonymousInlineDefinitionFields = removeEditorFields(
    inlineDefinitionFields,
    ['omitNull', 'omitWhenHidden']
  );
  const fieldDefinition = createFieldNodeEditorDefinition(
    originalFieldDefinition,
    inlineDefinitionFields,
    true
  );
  const arrayElementDefinition = createFieldNodeEditorDefinition(
    originalFieldDefinition,
    anonymousInlineDefinitionFields,
    false
  );
  schema.definitions = {
    [FIELD_DEFINITION_NAME]: fieldDefinition,
    [ARRAY_ELEMENT_DEFINITION_NAME]: arrayElementDefinition
  };
  fieldDefinitionsField.element = { $ref: FIELD_DEFINITION_NAME };
  if (!schemaDefinitionsField) {
    throw new Error('设计器 schema 缺少 definitions 配置区域。');
  }
  schemaDefinitionsField.category = 'record';
  delete schemaDefinitionsField.element;
  delete schemaDefinitionsField.fields;
  schemaDefinitionsField.kvDef = createSchemaDefinitionRecordEditor(
    anonymousInlineDefinitionFields
  );
  return schema;
}

/** 从编辑器字段列表中移除指定 key 的配置项。 */
function removeEditorFields(
  fields: FormFieldNode[],
  fieldKeys: readonly string[]
): FormFieldNode[] {
  const excludedKeys = new Set(fieldKeys);
  return fields.filter(fieldNode => {
    const field = resolveFormFieldNode(fieldNode);
    return !field?.key || !excludedKeys.has(field.key);
  });
}

/** 根据字段 key 查找设计器 schema 中的顶层字段。 */
function findCreatorSchemaField(
  schema: FormSchema,
  fieldKey: string
): FormField | undefined {
  return schema.fields
    .map(fieldNode => resolveFormFieldNode(fieldNode))
    .find(field => field?.key === fieldKey);
}

/** 从字段编辑器模板中移除仅普通字段需要的 key 和 name 控件。 */
function removeIdentityEditorFields(
  definition: FormFieldDefinition
): FormFieldNode[] {
  return (definition.fields ?? []).filter(fieldNode => {
    const field = resolveFormFieldNode(fieldNode);
    return field?.key !== 'key' && field?.key !== 'name';
  });
}

/** 在内联字段配置中插入 record 专用的 kvDef 编辑器。 */
function addRecordDefinitionEditor(
  fields: FormFieldNode[],
  originalDefinition: FormFieldDefinition
): FormFieldNode[] {
  const nextFields = cloneFieldNodes(fields);
  const objectFieldsIndex = nextFields.findIndex(fieldNode =>
    resolveFormFieldNode(fieldNode)?.key === 'fields'
  );
  const insertIndex = objectFieldsIndex < 0
    ? nextFields.length
    : objectFieldsIndex + 1;
  nextFields.splice(
    insertIndex,
    0,
    createRecordKeyValueEditor(originalDefinition)
  );
  return nextFields;
}

/** 创建 record 字段动态 key 和统一 value 的配置编辑器。 */
function createRecordKeyValueEditor(
  originalDefinition: FormFieldDefinition
): FormField {
  const keyFields = selectEditorFields(originalDefinition, [
    'name',
    'hint',
    'defaultValueJson',
    'componentDataKey',
    'componentDataJson',
    'component',
    'componentPropertiesJson',
    'rules'
  ]).flatMap(fieldNode => {
    const field = resolveFormFieldNode(fieldNode);
    if (!field) return [];
    const keyField = cloneField(field);
    delete keyField.binds;
    if (keyField.key === 'name') {
      keyField.name = 'Key 标签';
      keyField.required = false;
      keyField.rules = undefined;
    } else {
      keyField.name = `Key ${field.name ?? field.key ?? '配置'}`;
    }
    if (keyField.key === 'rules') {
      useRuleTypes(
        keyField,
        supportedRulesByFieldType.string ?? new Set()
      );
    }
    return [keyField];
  });

  return {
    key: 'kvDef',
    name: 'Record 键值定义',
    category: 'object',
    required: true,
    hint: 'Key 固定为字符串，Value 可以使用任意匿名字段或 definitions 引用。',
    fields: [
      {
        key: 'key',
        name: '动态 Key 定义',
        category: 'object',
        required: true,
        fields: keyFields
      },
      {
        $ref: ARRAY_ELEMENT_DEFINITION_NAME,
        key: 'value',
        name: '统一 Value 定义'
      }
    ],
    binds: [
      {
        sourceFormKey: 'formEasyCreator',
        sourceFieldId: './category',
        target: 'visible',
        resolver: "return sourceFieldValue === 'record';"
      }
    ]
  };
}

/** 创建一个支持内联配置和 definitions 引用的字段节点编辑器。 */
function createFieldNodeEditorDefinition(
  originalDefinition: FormFieldDefinition,
  inlineDefinitionFields: FormFieldNode[],
  requiresIdentity: boolean
): FormFieldDefinition {
  const identityFields = requiresIdentity
    ? selectEditorFields(originalDefinition, ['key', 'name'])
    : [];
  return {
    category: 'object',
    fields: [
      ...identityFields,
      createReferenceEditor(),
      ...inlineDefinitionFields.map(fieldNode =>
        applyReferenceVisibility(cloneFieldNode(fieldNode), false)
      ),
      ...createReferenceOverrideEditors(originalDefinition, requiresIdentity)
    ]
  };
}

/** 创建 definitions 的动态名称和匿名字段定义编辑器。 */
function createSchemaDefinitionRecordEditor(
  inlineDefinitionFields: FormFieldNode[]
): NonNullable<FormField['kvDef']> {
  return {
    key: {
      name: '定义名称',
      hint: '供 $ref 使用，必须在当前 schema 的 definitions 中唯一。',
      rules: [
        {
          type: 'pattern',
          value: '^[^.\\[\\]\\s]+$',
          message: '定义名称不能包含空白、点号或方括号。'
        }
      ],
      componentProperties: {
        placeholder: '例如 address'
      }
    },
    value: {
      category: 'object',
      fields: cloneFieldNodes(inlineDefinitionFields)
    }
  };
}

/** 创建引用目标选择器，并从当前 definitions 草稿动态读取选项。 */
function createReferenceEditor(): FormField {
  return {
    key: '$ref',
    name: '引用定义',
    category: 'basic',
    dataType: 'string',
    component: 'select',
    componentDataKey: 'creator-definition-options(definitions:formEasyCreator.schemaDefinitions)',
    componentProperties: {
      clearable: true,
      placeholder: '不引用，使用内联配置'
    },
    omitNull: true,
    hint: '不选择时使用同级内联配置；选择后生成 $ref 引用。'
  };
}

/** 创建引用节点可覆盖的全部实例属性编辑器。 */
function createReferenceOverrideEditors(
  originalDefinition: FormFieldDefinition,
  requiresIdentity: boolean
): FormFieldNode[] {
  const overrideFieldKeys = [
    'hint',
    'defaultValueJson',
    'componentDataKey',
    'componentDataJson',
    'componentPropertiesJson',
    'rules',
    'binds',
    'eventSubscriptions'
  ];
  if (requiresIdentity) {
    overrideFieldKeys.unshift('omitNull', 'omitWhenHidden');
  }
  const overrideFields = selectEditorFields(
    originalDefinition,
    overrideFieldKeys
  ).map(fieldNode => {
    const field = resolveFormFieldNode(fieldNode);
    if (!field) return fieldNode;
    const overrideField = cloneField(field);
    overrideField.key = `referenceOverride_${field.key}`;
    overrideField.name = `覆盖${field.name ?? field.key ?? '配置'}`;
    if (field.key === 'rules') {
      useAllRuleTypesForReference(overrideField);
    }
    return applyReferenceVisibility(overrideField, true);
  });
  return [
    applyReferenceVisibility({
      key: 'requiredOverride',
      name: '覆盖必填状态',
      category: 'basic',
      dataType: 'string',
      component: 'select',
      componentData: REQUIRED_OVERRIDE_OPTIONS
    }, true),
    ...overrideFields
  ];
}

/** 让引用规则类型显示全部候选项，具体兼容性由目标 schema 校验。 */
function useAllRuleTypesForReference(rulesField: FormField): void {
  const ruleTypes = new Set(
    Object.values(supportedRulesByFieldType).flatMap(types =>
      Array.from(types)
    )
  );
  useRuleTypes(rulesField, ruleTypes);
}

/** 将规则类型选择器改为指定的静态规则类型列表。 */
function useRuleTypes(
  rulesField: FormField,
  ruleTypes: ReadonlySet<string>
): void {
  const element = rulesField.element;
  if (!element || isFormFieldReference(element)) return;
  const typeField = element.fields
    ?.map(fieldNode => resolveFormFieldNode(fieldNode))
    .find(field => field?.key === 'type');
  if (!typeField) return;
  delete typeField.componentDataKey;
  typeField.componentData = Array.from(ruleTypes).map(ruleType => ({
    label: ruleType,
    value: ruleType
  }));
}

/** 从原始字段编辑器中按顺序复制指定字段。 */
function selectEditorFields(
  definition: FormFieldDefinition,
  fieldKeys: string[]
): FormFieldNode[] {
  const fieldsByKey = new Map(
    (definition.fields ?? []).flatMap(fieldNode => {
      const field = resolveFormFieldNode(fieldNode);
      return field?.key ? [[field.key, fieldNode] as const] : [];
    })
  );
  return fieldKeys.flatMap(fieldKey => {
    const fieldNode = fieldsByKey.get(fieldKey);
    return fieldNode ? [cloneFieldNode(fieldNode)] : [];
  });
}

/** 为编辑字段增加根据 $ref 是否存在控制可见性的绑定。 */
function applyReferenceVisibility(
  field: FormFieldNode,
  showWhenReference: boolean
): FormFieldNode {
  return {
    ...field,
    omitWhenHidden: true,
    binds: [
      ...(field.binds ?? []),
      {
        sourceFormKey: 'formEasyCreator',
        sourceFieldId: './$ref',
        target: 'visible',
        resolver: showWhenReference
          ? 'return sourceFieldValue !== null;'
          : 'return sourceFieldValue === null;'
      }
    ]
  };
}

/** 深复制一个字段节点，避免不同编辑器定义共享可变配置。 */
function cloneFieldNode<T extends FormFieldNode>(fieldNode: T): T {
  return JSON.parse(JSON.stringify(fieldNode)) as T;
}

/** 深复制一个普通字段配置。 */
function cloneField(field: FormField): FormField {
  return cloneFieldNode(field);
}

/** 深复制字段节点数组。 */
function cloneFieldNodes(fields: FormFieldNode[]): FormFieldNode[] {
  return fields.map(fieldNode => cloneFieldNode(fieldNode));
}

/** 驱动设计器配置区域的内部递归动态表单 schema。 */
const creatorSchema = createCreatorSchema();

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
    const category = typeof params.category === 'string'
      ? params.category
      : undefined;
    const dataType = typeof params.dataType === 'string'
      ? params.dataType
      : undefined;
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
  /** 隔离设计器内部规则选项的数据解析器。 */
  private readonly creatorComponentDataManager = createCreatorComponentDataManager();
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
              key={`creator-editor-${this.editorRevision}`}
              schema={creatorSchema}
              value={this.creatorFormValue}
              basicFieldRenderer={this.creatorRenderer}
              componentDataManager={this.creatorComponentDataManager}
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
