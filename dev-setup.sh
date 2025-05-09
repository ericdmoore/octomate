#!/bin/bash

set -e

echo "🔧 Installing dev dependencies..."
npm install --save-dev \
  eslint \
  @typescript-eslint/parser \
  @typescript-eslint/eslint-plugin \
  husky \
  lint-staged

echo "🧠 Initializing Husky..."
npx husky install
npm set-script prepare "husky install"

echo "🎯 Creating pre-commit hook..."
npx husky add .husky/pre-commit "npx lint-staged"

echo "📝 Configuring lint-staged..."
npx json -I -f package.json -e 'this["lint-staged"]={"*.ts": "eslint --fix"}'

echo "📐 Writing .eslintrc.js..."
cat <<EOL > .eslintrc.js
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module'
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  rules: {
    semi: ['error', 'always'],
    quotes: ['error', 'single']
  }
};
EOL

echo "✅ Done. Run this now to initialize husky for new clones:"
echo "   npm run prepare"
