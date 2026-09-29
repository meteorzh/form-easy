import { Config } from '@stencil/core';

export const config: Config = {
  namespace: 'formEasy',
  srcDir: 'src',
  extras: {
    enableImportInjection: true
  },
  outputTargets: [
    { type: 'dist' },
    { type: 'www', serviceWorker: null }
  ]
};
