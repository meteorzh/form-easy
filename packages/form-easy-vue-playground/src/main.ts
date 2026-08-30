import { createApp } from 'vue';
import App from './App.vue';
import { defineCustomElements } from 'form-easy/loader';
import { installVueBasicFieldRenderer } from 'form-easy-vue';

defineCustomElements();
installVueBasicFieldRenderer();
createApp(App).mount('#app');
