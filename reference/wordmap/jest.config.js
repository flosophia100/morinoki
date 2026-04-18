/**
 * Jest設定ファイル
 * 2025-07-07 作成: テスト環境設定
 */

module.exports = {
  // TypeScript サポート
  preset: 'ts-jest',
  testEnvironment: 'jsdom',

  // テストファイルの場所
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.(test|spec).+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],

  // TypeScript変換設定
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        target: 'ES2020',
        module: 'CommonJS',
        moduleResolution: 'node',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: false,
        skipLibCheck: true
      },
      isolatedModules: true
    }]
  },

  // モジュール解決
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },

  // セットアップファイル
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // カバレッジ設定
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // テスト環境設定
  testEnvironmentOptions: {
    url: 'http://localhost'
  },

  // タイムアウト設定
  testTimeout: 10000,

  // 並列実行設定
  maxWorkers: '50%',

  // 詳細出力
  verbose: true,

  // キャッシュ設定
  cache: true,
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',

  // モック設定
  clearMocks: true,
  restoreMocks: true,

  // エラー報告
  errorOnDeprecated: true,


  // 無視パターン
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ],
  
  // ファイル監視無視パターン
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],


  // レポーター設定
  reporters: ['default'],

  // ウォッチモード設定
  watchPlugins: []
};