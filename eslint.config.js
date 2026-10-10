import js from '@eslint/js';
import globals from 'globals';

// El lint cubre solo el código nuevo (módulos ES). Los scripts clásicos
// existentes (namespaces Epe*) se migran de a poco y entran acá a medida
// que se convierten.
export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**'],
  },
  js.configs.recommended,
  {
    files: [
      'js/features/dispositivo/**/*.js',
      'js/features/apps-epe/comunicacion-cabeza/**/*.js',
      'js/features/apps-epe/barrido/patrones.js',
      'js/features/apps-epe/barrido/motor.js',
      'js/features/apps-epe/barrido/eventos.js',
      'js/features/apps-epe/barrido/config.js',
      'js/features/apps-epe/barrido/tablero.js',
      'js/features/apps-epe/barrido/objetivos.js',
      'js/features/apps-epe/barrido/main.js',
      'js/features/apps-epe/vincular-imagen/arasaac.js',
      'dev/**/*.js',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        // provistos por Vitest (globals: true)
        test: 'readonly',
        expect: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        vi: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];
