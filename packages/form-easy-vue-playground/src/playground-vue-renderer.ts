import { createVueBasicFieldRenderer } from '@wenzhencn/form-easy-vue';
import PlaygroundVueInput from './components/PlaygroundVueInput.vue';

/** Playground 的专用 Vue 渲染器，只影响传入该实例的表单。 */
export const playgroundVueRenderer = createVueBasicFieldRenderer();

/** 为 Playground 专用渲染器注册 Vue 字段组件。 */
playgroundVueRenderer.registerFieldComponent('playgroundVueInput', PlaygroundVueInput);
