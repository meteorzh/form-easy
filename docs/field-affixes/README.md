# 字段展示位

本文是 `affixes` 的实现说明。它描述标签前、标签后、控件前、控件后如何展示只读内容，以及超链接如何把自定义事件交给表单使用者处理。实现代码时以本文为准。

展示位是字段壳的一部分，由 `form-easy-field` 渲染。H5、Vue 和 Element Plus 渲染器继续只负责真正的输入控件。

## 目标

- 命名字段和 definitions 模板可以放展示内容。命名位置上的 `$ref` 可以整份覆盖模板中的 `affixes`。
- 基础字段可以使用四个位置。数组、对象和 record 字段只可以使用标签前后，不能使用控件前后。
- 每个位置可以有多段内容，类型为普通文本、超链接、图片或图标。
- 展示内容不进入表单值，不参与字段校验，也不触发 `onChange`。
- 超链接可以导航，也可以派发用户事件。使用者通过事件中心或表单 DOM 事件自行响应，schema 不指定字段操作命令。
- 图片尺寸由系统决定，点击后在表单内查看大图。图标使用固定小尺寸，不能打开大图。

## 不支持的位置

数组元素和 record 动态 key 不支持 `affixes`。两者都是一份定义重复渲染：key 的具体文本要等用户输入后才知道，数组元素也会逐项套用同一份展示内容。定义时加上展示位，每一项看到的都一样，没有实际意义。

因此：

- record 的 `kvDef.key` 不能写 `affixes`。合成内部 key 字段时也不要从 key 定义上带出这个属性。
- 数组的 `element` 节点不能写 `affixes`。这包括内联元素，也包括 `$ref` 上的覆盖。
- 被引用的 definitions 模板如果本身有 `affixes`，命名字段引用时照常生效；同一个模板被当作数组元素引用时，渲染丢弃其中的 `affixes`，不报错。这样一份模板仍然可以同时给命名字段和数组元素使用。
- 数组元素内部的命名子字段不受影响。例如元素是对象时，对象里的 `price` 字段仍然可以在自己的控件后显示“元”。禁止的是元素这一层本身。
- record 的 `kvDef.value` 仍可配置 `affixes`。value 是每个动态值共用的字段定义，单位、说明链接这类展示有意义。本次只排除 key。value 自身如果是数组、对象或 record，同样不能配置控件前后的展示位。
- 数组、对象和 record 字段的控件较高，不能配置 `controlBefore` 或 `controlAfter`。标签前后仍然可以配置。渲染时也会丢掉这两侧，避免未通过校验的 schema 把布局撑开。

## 非目标

- 不解析 HTML、Markdown，不在展示位挂自定义 Vue 组件。
- 展示文案不绑定其他字段，也不执行 resolver。
- 不把内容画进输入框内部的 prefix 或 suffix。数组、对象和 record 字段不在控件两侧放展示内容。
- 不把用户事件接入现有的 `eventSubscriptions`。`show`、`hide`、`change` 这些字段命令仍然只由字段事件驱动。
- 不因为字段禁用而禁用展示位交互。隐藏字段和被收起的 optional 控件区除外，因为对应 DOM 不会渲染。
- 不接受 schema 指定图片宽高。

## Schema

`affixes` 放在字段公共配置上。basic 字段可以使用四个位置。数组、对象、record 字段，以及同样属于这三类的 record value，只能使用标签前后。数组字段作为命名字段时，展示位属于这个数组字段本身，不属于它的 `element`。

`$ref` 仍按整份属性浅覆盖。实例写了 `affixes` 就替换模板中的整份对象，不按四个位置合并。数组元素位置不允许这种覆盖。

```ts
type FieldAffixSlot =
  | 'labelBefore'
  | 'labelAfter'
  | 'controlBefore'
  | 'controlAfter';

interface FieldAffixes {
  labelBefore?: FieldAffix[];
  labelAfter?: FieldAffix[];
  controlBefore?: FieldAffix[];
  controlAfter?: FieldAffix[];
}

type FieldAffix =
  | FieldAffixText
  | FieldAffixLink
  | FieldAffixImage
  | FieldAffixIcon;
```

只使用对象，不接受字符串简写。设计器的表单值会直接成为目标 schema，对象形式才能原样往返。

```json
{
  "key": "price",
  "name": "价格",
  "category": "basic",
  "dataType": "number",
  "affixes": {
    "labelBefore": [
      { "type": "text", "text": "A." }
    ],
    "labelAfter": [
      {
        "type": "link",
        "text": "计价说明",
        "action": {
          "name": "openPriceHelp",
          "payload": { "topic": "price" }
        }
      }
    ],
    "controlBefore": [
      { "type": "icon", "src": "/icons/currency.svg", "alt": "" },
      { "type": "text", "text": "¥" }
    ],
    "controlAfter": [
      { "type": "text", "text": "元" },
      {
        "type": "image",
        "src": "https://cdn.example.com/coin.png",
        "alt": "货币示意图"
      }
    ]
  }
}
```

`affixes` 不是 `optional`、`omitNull`、`omitWhenHidden` 那种输出控制属性。definitions 模板可以携带它，但模板本身仍然不能写 `key`、`name` 和那三项输出控制属性。

## 元素

同一位置内的元素按数组顺序横向排列。元素之间不嵌套：需要并排显示图标和链接时，写成相邻的两个元素，而不是链接包住图标。

### 文本

```ts
interface FieldAffixText {
  type: 'text';
  text: string;
}
```

`text` 必填。渲染前去掉首尾空白，去掉后为空则 schema 无效。最长 200 个字符。用文本节点输出，不使用 `innerHTML`。

### 超链接

```ts
interface FieldAffixLink {
  type: 'link';
  text: string;
  href?: string;
  target?: '_self' | '_blank';
  action?: FieldAffixAction;
}

interface FieldAffixAction {
  name: string;
  payload?: unknown;
}
```

`text` 规则与普通文本相同。`href` 和 `action` 至少要有一个。

`href` 只允许以下形式：

- `http:` 与 `https:`
- `mailto:` 与 `tel:`
- 不带 scheme 的相对路径，例如 `./help`、`../help`、`/help`

拒绝 `javascript:`、`data:`、`blob:`、`file:` 以及以 `//` 开头的协议相对地址。`target` 只能是 `_self` 或 `_blank`，并且只有存在 `href` 时才能写。缺省是 `_self`，schema 里不必写出。`_blank` 渲染时固定加上 `rel="noopener noreferrer"`。

`action` 是展示位当前声明用户事件的方式。`action.name` 会成为用户事件的 `name`。格式为 `^[A-Za-z][A-Za-z0-9_-]*$`，最长 64 个字符。它和 `onChange` 这些字段事件不是同一个命名空间，允许字符串相同，但不会进入字段订阅。

`payload` 可选，必须是纯 JSON：`null`、布尔、有限数字、字符串、数组或普通对象。不允许函数、`undefined`、`Symbol`、`bigint`、类实例和循环引用。嵌套最多 8 层。payload 是 schema 中的静态数据，点击时不会读取字段当前值。

渲染分三种：

- 只有 `href`：渲染 `<a>`，不拦截点击，修饰键和中键保持浏览器默认行为。
- 只有 `action`：渲染 `type="button"` 的按钮，外观与链接一致。不能使用 `href="#"`。
- 两者都有：渲染 `<a>`。普通主键点击先派发用户事件；事件被取消则停留在当前页，否则继续导航。带 Ctrl、Meta、Shift、Alt 的点击以及中键不派发事件，交给浏览器处理 `href`。

导航由展示位自己完成。`_self` 设置 `window.location.href`，`_blank` 使用 `window.open(url, '_blank', 'noopener,noreferrer')`。

### 图片

```ts
interface FieldAffixImage {
  type: 'image';
  src: string;
  alt: string;
}
```

`src` 允许 `http:`、`https:` 和不带 scheme 的相对路径。不允许 `mailto:`、`tel:`、`data:`、`blob:`、`javascript:` 和协议相对地址。远程图片会由浏览器按 schema 发起请求；框架保证不执行其中的脚本，因为只通过 `<img>` 展示。

`alt` 必填，去掉首尾空白后不能为空，最长 200 个字符。

schema 不提供 `width` 或 `height`。缩略图是正方形，宽高比 1:1，尺寸和垂直位置都跟随它所在的那一侧：

- 标签前、标签后的图片，边长等于标签文字的行高，并与标签垂直居中对齐。
- 控件前、控件后的图片，边长等于控件高度，并与控件垂直居中对齐。对象、数组、record 编辑器变高时，这一侧的图片跟着变高，而不是固定成标签行高。
- 图片在正方形盒子内使用 `object-fit: contain`。

图片渲染为按钮里的 `<img>`。点击、Enter 和 Space 打开当前字段内的大图，不派发用户事件。加载失败时隐藏破损图标，改为显示 `alt`。

大图层使用 `role="dialog"`、`aria-modal="true"` 和 `aria-label="查看图片"`。大图恢复图片自身比例，最大不超过视口的 90%。点击遮罩、关闭按钮或 Escape 关闭，关闭后焦点回到原来的缩略图按钮。蒙层直接挂到 `document.body`，避免表单祖先上的 `transform` 或滚动容器把 `position: fixed` 限制在表单范围内。同一字段同时只打开一张大图。

### 图标

```ts
interface FieldAffixIcon {
  type: 'icon';
  src: string;
  alt?: string;
}
```

`src` 规则与图片相同。图标固定绘制为 16×16，不能打开大图。图标对象上不允许出现 `width`、`height`、`href` 或 `action`。

`alt` 省略或为空时，图标 `aria-hidden="true"`。写了 `alt` 时按说明文字暴露给辅助技术。图标没有点击行为。

## 布局

现有字段壳是：

```text
.field-label
  名称、必填星号、optional 开关
small
  hint
.editor
  控件
  校验错误
```

有名称、optional 开关，或任一标签侧展示位时，都渲染标签行。只有控件侧展示位时，仍然可以走没有标签列的单列布局。

```text
.field-label
  .field-label-main
    [labelBefore...]
    名称与必填星号
    [labelAfter...]
  optional 开关
```

```text
.editor
  .editor-line
    [controlBefore...]
    .editor-control      原控件或嵌套编辑器；基础字段有控件侧展示位时不拉伸
    [controlAfter...]
  校验错误
```

标签行里的文本、链接、图标和图片都与标签垂直居中对齐。控件行拉伸到控件本身的高度：文本、链接和图标在这条高度内垂直居中，图片则占满控件高度并保持 1:1。控件变高时，控件前后的展示内容仍然对齐到控件，不留在顶部。

展示文本使用次要色和正常字重。每个元素带上对应的 `part`：`label-before`、`label-after`、`control-before`、`control-after`。同一位置有多个元素时，这些 `part` 可以重复。

## 与字段状态的关系

- `visible === false`：字段不渲染，四个位置都不存在。
- optional 被收起：控件和控件两侧展示位一起不渲染；标签两侧展示位保留，链接和图片预览仍可使用。
- 字段或父级禁用：输入控件禁用，展示位交互不禁用。
- 组件数据加载中或加载失败：加载状态属于控件内容，控件两侧展示位仍然渲染。
- 展示位不写入 `FormValueStore`，不影响 `omitNull` 和对外表单数据。

## 事件中心

现有 `EventCenter` 是字段命令路由器。`subscribe()` 和 `publish()` 只接受 `onShow`、`onChange` 这样的固定事件，并把它们变成 `show`、`change` 这样的固定命令，同时用 `fieldId::eventName` 做循环检测。用户事件不能进入这条通道，否则会和字段订阅、循环检测混在一起。

两条通道都留在同一个 `EventCenter` 上，但用户事件不叫 affix 事件。展示位链接只是第一个入口，以后还可以从其他位置派发同一种用户事件。现有 `subscribe()` 和 `publish()` 的签名不变。

```ts
interface UserEvent {
  /** 使用者识别事件的稳定名称。 */
  name: string;
  /** 派发该事件的表单键。 */
  formKey: string;
  /** 事件从哪个入口发出。以后可以增加 affix 以外的类型。 */
  source: UserEventSource;
  /** 入口声明的静态数据。 */
  payload?: unknown;
}

interface AffixUserEventSource {
  type: 'affix';
  fieldId: string;
  slot: FieldAffixSlot;
  index: number;
}

type UserEventSource = AffixUserEventSource;

type UserEventListener = (event: UserEvent) => void | false;
```

新增两个方法：

- `addUserEventListener(listener)`：注册用户事件监听，返回取消注册的函数。
- `dispatchUserEvent(event)`：同步调用当前监听器，返回是否允许入口继续自己的默认行为。任一监听器返回 `false` 时结果为取消。

展示位链接把 `action.name` 和 `action.payload` 放进 `UserEvent`，并把 `source.type` 设为 `'affix'`。以后新增入口时只扩展 `UserEventSource`，不再给事件中心加一套新的注册方法。

用户事件的隔离边界和字段事件相同。表单没有传入 `eventCenter` 时使用全局中心，监听器会收到所有使用全局中心的用户事件。传入独立 `EventCenter` 时，只有共享该实例的表单会互相看见。设计器预览已经使用单独的事件中心，因此预览里的链接不会触发设计器内部表单的用户事件。

派发时维护一条同步调用栈。栈上已经存在同一事件身份时，停止本次派发，在控制台输出错误，并按已取消处理。当前 affix 入口的身份是 `formKey + source.type + fieldId + slot + index + name`。新入口要定义自己的身份字段，不能只比较 `name`。这里不复用字段事件的 `history`，因为两个通道的身份不同。

`form-easy` 在连接时向自己的事件中心注册桥接监听，断开或更换 `eventCenter` 时取消注册。桥接监听只处理 `formKey` 与当前表单一致的用户事件，然后在宿主元素上发出可取消的 DOM 事件：

```ts
userEvent: CustomEvent<UserEvent>
```

事件设置 `bubbles`、`composed` 和 `cancelable`。桥接监听在 DOM 事件执行完后，如果 `defaultPrevented` 就返回 `false`。因此取消默认行为有两种等价方式：用户事件监听器返回 `false`，或 DOM 监听器调用 `preventDefault()`。两种都用时，任一取消即取消。对链接来说，默认行为是导航。

链接点击的顺序是：

1. 只有 `href` 时不进入事件中心。
2. 存在 `action` 时调用 `dispatchUserEvent`。
3. `dispatchUserEvent` 先通知用户事件监听器；其中的表单桥接再同步发出 `userEvent`。
4. 返回取消，或链接没有 `href` 时，停在当前页。
5. 未取消且存在 `href` 时，按 `target` 导航。

字段之间的 `eventSubscriptions` 不能订阅用户事件。如果点击后要改另一个字段，由使用者在监听器里调用现有表单 API 或修改表单值。

## 宿主接入

原生监听：

```ts
const form = document.querySelector('form-easy');
form.addEventListener('userEvent', event => {
  const userEvent = event.detail;
  if (userEvent.name !== 'openPriceHelp') return;
  if (userEvent.source.type !== 'affix') return;
  openHelp(userEvent.payload);
  event.preventDefault();
});
```

直接使用事件中心时，监听范围遵循该实例的隔离边界：

```ts
const eventCenter = new EventCenter();
eventCenter.addUserEventListener(userEvent => {
  if (userEvent.name !== 'openPriceHelp') return;
  openHelp(userEvent.payload);
  return false;
});
```

Vue 包装组件追加 `userEvent` 转发，不改变 `v-model` 和 `formChange`：

```vue
<FormEasy :schema="schema" @user-event="handleUserEvent" />
```

同一个用户事件不要在事件中心和 DOM 事件里各处理一次，除非确实需要两个副作用。

## 校验

`validateFormSchema()` 把 `affixes` 加入命名字段、字段引用和 record value 的属性白名单。不要加入 record key 的白名单，也不要把它当作数组元素的合法属性。空对象和空数组有效，渲染时等于没有内容。

数组 `element` 节点或该位置上的 `$ref` 覆盖如果写了 `affixes`，使用 `forbidden-property`。record key 上出现 `affixes` 时，按 key 定义的未知属性处理，使用 `unknown-property`。

每个展示元素按 `type` 检查属性白名单：

| type | 允许的属性 |
| --- | --- |
| `text` | `type`、`text` |
| `link` | `type`、`text`、`href`、`target`、`action` |
| `image` | `type`、`src`、`alt` |
| `icon` | `type`、`src`、`alt` |

`action` 只允许 `name` 和 `payload`。图片或图标上的 `width`、`height` 按未知属性处理。未知属性使用 `unknown-property`，类型错误使用 `invalid-type`，枚举、URL 和长度使用 `invalid-value`，链接缺少 `href` 与 `action` 时使用 `missing-property`。不新增问题代码。

URL 校验失败的消息要写明允许的协议，不要只写“格式错误”。

## 设计器

`creator-schema.json` 的 `definitions` 属于设计器自己的模板，不会进入用户 schema。在其中增加：

- `fieldAffix`：一个对象。`type` 使用 select，可选文本、超链接、图片、图标。其余属性按类型用 `visible` 绑定控制显示，并设置 `omitWhenHidden`，避免隐藏项仍输出到 schema。链接的 `action` 是可选对象，未设置时不输出。图片和图标都不提供尺寸输入。
- `fieldAffixes`：包含四个可选数组，元素引用 `fieldAffix`。四个数组本身也设为 optional，没有条目时不输出对应的键。控件前和控件后在字段分类为数组、对象或 record 时隐藏，并用 `omitWhenHidden` 避免写入 schema。

只在命名字段编辑对象，以及 record value 的字段编辑对象上，增加可选的 `affixes`，引用 `fieldAffixes`。不要加到数组 `element` 的编辑对象上，也不要加到 record key 的编辑对象上。不要把这组配置复制到每一处字段编辑块中。

设计器预览使用独立事件中心。预览中的链接可以导航或打开大图，但用户事件只出现在预览表单元素上，不进入左侧配置表单。

## 实现落点

1. 在 `form-field-types.ts` 增加展示位类型，并挂到 `FormFieldCommonConfiguration` 和 `FormFieldReferenceCommonOverrides`。不要挂到 `FormRecordKeyDefinition`。
2. 在 schema 校验器中增加白名单和逐元素校验。数组元素位置拒绝 `affixes`。URL 与 JSON payload 的判断放在校验模块内，渲染前再调用同一套判断，避免两套规则。
3. 数组元素渲染前去掉已解析字段上的 `affixes`。record 合成 key 字段时不复制 `affixes`。
4. 给 `EventCenter` 增加 `addUserEventListener()` 和 `dispatchUserEvent()`，保持 `subscribe()` 和 `publish()` 不变。
5. 在 `form-easy-field` 渲染四个位置、链接交互和大图层。标签侧图片对齐标签高度，控件侧图片对齐控件高度。
6. 在 `form-easy` 建立用户事件到 `userEvent` 的桥接，并处理 `eventCenter` 更换。
7. 在 Vue 的 `FormEasy` 转发 `userEvent`。Element Plus 渲染器不用修改。
8. 更新 `creator-schema.json`。
9. 在项目 README 的字段配置说明中补一个价格字段例子，并说明 `hint` 是控件下方的说明，`affixes` 是贴在标签和控件两侧的展示元素。同时写明数组元素和 record key 不支持展示位。

## 测试

- 四个位置按顺序渲染文本、链接、图片和图标；输出对象不包含这些内容。
- 没有字段名但有标签展示位时保留标签列；只有控件展示位时保持单列。
- optional 收起后，控件两侧消失，标签两侧仍可点击。
- 字段隐藏时不渲染展示位。禁用字段时链接和图片预览仍可用。
- 非法 URL、过长文本、图片上的 `width` 或 `height`、图标上的尺寸属性、链接同时缺少 `href` 和 `action`，都产生对应校验问题。
- 数组 `element` 及其 `$ref` 覆盖写了 `affixes` 时校验失败。模板带有 `affixes` 而被数组元素引用时，元素不渲染这些展示位，同名模板用于命名字段时仍然渲染。
- 对象类型的数组元素内部，命名子字段的 `affixes` 正常渲染。
- record key 写了 `affixes` 时校验失败，key 编辑器不显示展示位。record value 的展示位会显示在每个动态值上。
- `$ref` 在命名位置整份替换 `affixes`。
- 只有 `action` 的链接渲染按钮并派发 `source.type === 'affix'` 的用户事件。`href` 与 `action` 同时存在时，监听器返回 `false` 或 DOM `preventDefault()` 都会阻止导航。修饰键点击不派发事件。
- 独立 `EventCenter` 收不到使用全局中心的用户事件；同一用户事件的同步重入会停止并报告错误。
- 标签侧图片使用标签高度，控件侧图片使用控件高度，两侧都保持 1:1 并与对应内容对齐。schema 不能改变尺寸。点击只打开大图，不产生 `userEvent`。Escape 关闭后焦点回到缩略图。
- Vue 包装组件能收到 `userEvent`，并且不改变 `formChange` 的载荷。
