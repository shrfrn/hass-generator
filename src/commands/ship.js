// @ts-check
import { existsSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'

/**
 * @param {{ full?: boolean, deploy?: boolean }} options
 */
export async function ship(options = {}) {
	const cwd = process.cwd()
	const { full, deploy = true } = options

	console.log('🚀 Ship pipeline starting...\n')

	// Step 1: Inventory (if --full)
	if (full) {
		console.log('📦 Step 1/4: Running inventory...')
		const { inventory } = await import('./inventory.js')
		await inventory()
		console.log('')
	}

	// Step 2: Generate
	console.log(`⚙️  Step ${full ? '2/4' : '1/3'}: Generating...`)
	const { generate } = await import('./generate.js')
	await generate({ force: true })
	console.log('')

	// Step 3: Git commit
	console.log(`📝 Step ${full ? '3/4' : '2/3'}: Committing changes...`)
	await runCommand('git', ['add', '-A'], cwd)

	const commitResult = await runCommand('git', ['commit', '-m', 'Generated configs'], cwd)
	if (commitResult.code !== 0 && !commitResult.stderr.includes('nothing to commit')) {
		console.error('❌ Git commit failed')
		process.exit(1)
	}
	console.log('')

	// Step 4: Deploy
	if (deploy) {
		const deployScript = join(cwd, 'deploy.sh')

		if (!existsSync(deployScript)) {
			console.log('⏭️  No deploy.sh found, skipping deploy')
		} else {
			console.log(`🚢 Step ${full ? '4/4' : '3/3'}: Deploying...`)
			await runCommand('bash', ['deploy.sh'], cwd)
		}
	} else {
		console.log('⏭️  Deploy skipped (--no-deploy)')
	}

	console.log('\n✨ Ship complete!')
}

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {string} cwd
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
function runCommand(cmd, args, cwd) {
	return new Promise((resolve) => {
		const proc = spawn(cmd, args, { cwd, stdio: 'pipe' })

		let stdout = ''
		let stderr = ''

		proc.stdout?.on('data', (data) => {
			stdout += data.toString()
			process.stdout.write(data)
		})

		proc.stderr?.on('data', (data) => {
			stderr += data.toString()
			process.stderr.write(data)
		})

		proc.on('close', (code) => {
			resolve({ code: code || 0, stdout, stderr })
		})
	})
}

