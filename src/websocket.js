// @ts-check
import WebSocket from 'ws'

let messageId = 1
let ws = null
const pendingCommands = new Map()
let haVersion = null

/**
 * Get the Home Assistant version string
 * @returns {string|null} HA version or null if not connected
 */
export function getHaVersion() {
	return haVersion
}

/**
 * Connect to Home Assistant WebSocket API
 * @param {string} host - HA host address
 * @param {number} port - HA port (usually 8123)
 * @param {string} token - Long-lived access token
 * @returns {Promise<void>} Resolves when authenticated
 */
export function connect(host, port, token) {
	return new Promise((resolve, reject) => {
		const url = `ws://${host}:${port}/api/websocket`

		ws = new WebSocket(url)

		ws.on('error', err => {
			reject(new Error(`WebSocket error: ${err.message}`))
		})

		ws.on('close', () => {
			console.log('WebSocket connection closed')
		})

		ws.on('message', data => {
			const message = JSON.parse(data.toString())
			handleMessage(message, token, resolve, reject)
		})
	})
}

function handleMessage(message, token, resolve, reject) {
	const { type, id } = message

	if (type === 'auth_required') {
		haVersion = message.ha_version
		console.log(`Connected to Home Assistant ${haVersion}`)
		sendAuth(token)
		return
	}

	if (type === 'auth_ok') {
		console.log('Authentication successful')
		resolve()
		return
	}

	if (type === 'auth_invalid') {
		reject(new Error(`Authentication failed: ${message.message}`))
		return
	}

	if (type === 'result') {
		const pending = pendingCommands.get(id)

		if (pending) {
			pendingCommands.delete(id)

			if (message.success) {
				pending.resolve(message.result)
			} else {
				pending.reject(new Error(`Command failed: ${message.error?.message || 'Unknown error'}`))
			}
		}
	}
}

function sendAuth(token) {
	ws.send(JSON.stringify({
		type: 'auth',
		access_token: token,
	}))
}

/**
 * Send a WebSocket command to Home Assistant
 * @param {string} type - Command type (e.g., 'get_states')
 * @param {object} [payload={}] - Additional command payload
 * @returns {Promise<any>} Command result
 */
export function sendCommand(type, payload = {}) {
	return new Promise((resolve, reject) => {
		const id = messageId++

		pendingCommands.set(id, { resolve, reject })

		const message = { id, type, ...payload }

		ws.send(JSON.stringify(message))
	})
}

/**
 * Disconnect from Home Assistant WebSocket
 */
export function disconnect() {
	if (ws) {
		ws.close()
		ws = null
	}
}

