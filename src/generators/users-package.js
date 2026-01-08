import { existsSync, readFileSync, writeFileSync } from 'fs'
import { paths } from '../paths.js'

export async function generateUsersFile(inventory) {
  console.log('\nGenerating users.js...')

  const { persons } = inventory

  if (!persons || persons.length === 0) {
    console.log('  ⚠ No persons found in inventory')
    return
  }

  const usersPath = paths.usersConfig()
  const manualGroups = extractManualGroups(usersPath)

  const lines = [
    '// Home Assistant user IDs',
    '// Auto-generated from inventory - DO NOT edit the USERS block',
    '// Add custom groups below the auto-generated section',
    '',
    'export const USERS = {',
  ]

  // Generate USERS entries from persons
  for (const person of persons) {
    if (!person.user_id) continue

    const key = extractFirstName(person.name).toLowerCase()
    lines.push(`  ${key}: '${person.user_id}',`)
  }

  lines.push('}')
  lines.push('')

  // Add manual groups section
  if (manualGroups.length > 0) {
    lines.push(...manualGroups)
  } else {
    // Default groups template
    lines.push('// Pre-defined groups for convenience')
    lines.push('// Customize these based on your household')
    lines.push('export const ALL = Object.values(USERS)')
    lines.push('')
  }

  writeFileSync(usersPath, lines.join('\n'))
  console.log('  ✓ users.js')
}

function extractFirstName(fullName) {
  return fullName.split(' ')[0]
}

function extractManualGroups(filePath) {
  if (!existsSync(filePath)) return []

  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const manualLines = []

  let pastUsersBlock = false

  for (const line of lines) {
    // Detect end of USERS block
    if (line.trim() === '}' && !pastUsersBlock) {
      pastUsersBlock = true
      continue
    }

    // Capture everything after USERS block
    if (pastUsersBlock) {
      manualLines.push(line)
    }
  }

  // Remove leading empty lines but keep trailing structure
  while (manualLines.length > 0 && manualLines[0].trim() === '') {
    manualLines.shift()
  }

  return manualLines
}
