// @ts-check
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const templatesDir = join(__dirname, '..', '..', 'templates')

export async function init() {
  const cwd = process.cwd()
  
  const files = [
    { src: 'generator.config.js', dest: 'generator.config.js' },
    { src: 'dashboard.config.js', dest: 'dashboard.config.js' },
    { src: 'users.js', dest: 'users.js' },
    { src: 'deploy.sh', dest: 'deploy.sh' },
    { src: 'package.json', dest: 'package.json' },
    { src: '.env.example', dest: '.env.example' },
  ]

  console.log('🏠 Initializing HASS generator project...\n')

  for (const file of files) {
    const destPath = join(cwd, file.dest)
    
    if (existsSync(destPath)) {
      console.log(`  ⏭️  ${file.dest} (already exists, skipping)`)
      continue
    }

    const srcPath = join(templatesDir, file.src)
    copyFileSync(srcPath, destPath)
    console.log(`  ✅ ${file.dest}`)
  }

  // Create inventory folder
  const inventoryDir = join(cwd, 'inventory', 'types')
  if (!existsSync(inventoryDir)) {
    mkdirSync(inventoryDir, { recursive: true })
    console.log(`  ✅ inventory/types/`)
  }

  console.log('\n✨ Done! Next steps:')
  console.log('   1. Edit .env with your HASS connection details')
  console.log('   2. Run: npm install')
  console.log('   3. Run: npx hass-gen inventory')
  console.log('   4. Edit generator.config.js with your area overrides')
  console.log('   5. Run: npx hass-gen generate')
}

