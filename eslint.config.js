const tseslint = require('typescript-eslint');
module.exports = [{ignores:['build/**','dist/**','node_modules/**']}, {
 files:['src/**/*.ts','src/**/*.tsx'],
 languageOptions:{parser:tseslint.parser,parserOptions:{ecmaFeatures:{jsx:true}}},
 plugins:{'@typescript-eslint':tseslint.plugin},
 rules:{
 'no-eval':'error','no-implied-eval':'error','no-new-func':'error',
 'no-unsafe-finally':'error','no-duplicate-case':'error','no-unreachable':'error',
 'no-debugger':'error','@typescript-eslint/no-unsafe-declaration-merging':'error'
 }
}];
