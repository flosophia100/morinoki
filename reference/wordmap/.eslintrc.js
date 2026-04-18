/**
 * ESLint設定ファイル
 * 2025-07-07 作成: TypeScript用の静的解析設定
 */

module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'prettier'
  ],
  plugins: ['@typescript-eslint', 'prettier'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  env: {
    browser: true,
    es6: true,
    node: true,
    jest: true
  },
  rules: {
    // Prettier関連
    'prettier/prettier': 'error',

    // TypeScript関連
    '@typescript-eslint/no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': ['warn', {
      allowExpressions: true,
      allowTypedFunctionExpressions: true
    }],
    '@typescript-eslint/prefer-const': 'error',
    '@typescript-eslint/no-inferrable-types': 'off',
    '@typescript-eslint/explicit-member-accessibility': ['error', {
      accessibility: 'explicit',
      overrides: {
        constructors: 'no-public'
      }
    }],

    // 一般的なルール
    'no-console': ['warn', { 
      allow: ['warn', 'error'] 
    }],
    'no-debugger': 'error',
    'no-alert': 'warn',
    'no-var': 'error',
    'prefer-const': 'error',
    'no-unused-expressions': 'error',
    'no-duplicate-imports': 'error',
    'no-multiple-empty-lines': ['error', { 
      max: 2, 
      maxEOF: 1 
    }],
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],

    // コード品質
    'complexity': ['warn', 10],
    'max-depth': ['warn', 4],
    'max-lines': ['warn', 500],
    'max-lines-per-function': ['warn', 100],
    'max-params': ['warn', 5],

    // セキュリティ
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',

    // ベストプラクティス
    'no-magic-numbers': ['warn', {
      ignore: [-1, 0, 1, 2],
      ignoreArrayIndexes: true,
      enforceConst: true
    }],
    'prefer-template': 'error',
    'object-shorthand': 'error',
    'no-useless-concat': 'error'
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.spec.ts'],
      env: {
        jest: true
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-magic-numbers': 'off',
        'max-lines-per-function': 'off'
      }
    },
    {
      files: ['**/*.js'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-member-accessibility': 'off'
      }
    }
  ],
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'coverage/',
    '*.min.js',
    'legacy-files/'
  ]
};