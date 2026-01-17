// @ts-check
import js from '@eslint/js'

export default [
	js.configs.recommended,
	{
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			globals: {
				console: 'readonly',
				process: 'readonly',
				URL: 'readonly',
				// Vitest globals
				describe: 'readonly',
				test: 'readonly',
				expect: 'readonly',
				beforeEach: 'readonly',
				afterEach: 'readonly',
				vi: 'readonly',
			},
		},
		rules: {
			// Style rules matching project conventions
			'semi': ['error', 'never'],
			'quotes': ['error', 'single', { avoidEscape: true }],
			'indent': ['error', 'tab'],
			'comma-dangle': ['error', 'always-multiline'],
			'no-trailing-spaces': 'error',
			'eol-last': ['error', 'always'],

			// Spacing
			'object-curly-spacing': ['error', 'always'],
			'array-bracket-spacing': ['error', 'never'],
			'space-before-function-paren': ['error', {
				anonymous: 'never',
				named: 'never',
				asyncArrow: 'always',
			}],
			'arrow-spacing': ['error', { before: true, after: true }],
			'keyword-spacing': ['error', { before: true, after: true }],
			'space-infix-ops': 'error',

			// Best practices
			'eqeqeq': ['error', 'always', { null: 'ignore' }],
			'no-var': 'error',
			'prefer-const': 'error',
			'prefer-arrow-callback': 'error',
			'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
			'no-console': 'off', // CLI tool - console is expected

			// Allow single-line conditionals without braces
			'curly': ['error', 'multi-line'],
		},
	},
	{
		ignores: ['node_modules/**', 'templates/**'],
	},
]

