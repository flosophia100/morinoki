/**
 * Prettier設定ファイル
 * 2025-07-07 作成: コードフォーマット規則
 */

module.exports = {
  // 基本設定
  semi: true,
  singleQuote: true,
  quoteProps: 'as-needed',
  trailingComma: 'es5',
  
  // インデント設定
  tabWidth: 2,
  useTabs: false,
  
  // 行幅設定
  printWidth: 100,
  
  // 括弧設定
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'avoid',
  
  // 改行設定
  endOfLine: 'lf',
  
  // 特定ファイル用の設定
  overrides: [
    {
      files: '*.json',
      options: {
        printWidth: 80,
        tabWidth: 2
      }
    },
    {
      files: '*.md',
      options: {
        printWidth: 80,
        proseWrap: 'always'
      }
    },
    {
      files: '*.html',
      options: {
        printWidth: 120,
        tabWidth: 4
      }
    },
    {
      files: '*.css',
      options: {
        printWidth: 120,
        tabWidth: 2
      }
    }
  ]
};