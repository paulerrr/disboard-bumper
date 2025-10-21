require('dotenv').config()
const { Client } = require('discord.js-selfbot-v13')

// Constants
const DISBOARD_BOT_ID = '302050872383242240'
const DISCADIA_BOT_ID = '1222548162741538938'
const ACCOUNT_COOLDOWN = 30 * 60 * 1000 // 30 minutes in milliseconds (only applies to Disboard)
const MIN_SERVER_COOLDOWN = 2 * 60 * 60 * 1000 // 2 hours in milliseconds (Disboard)
const MAX_SERVER_COOLDOWN = 2.5 * 60 * 60 * 1000 // 2.5 hours in milliseconds (Disboard)
const DISCADIA_COOLDOWN = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

// State management
let accounts = [] // Array of account objects
let servers = [] // Array of server objects with account associations
let scheduledTimeout = null

// Utility functions
function getRandomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

function formatTime(date) {
    return date.toLocaleTimeString('en-US', { hour12: false })
}

function parseAccountConfig() {
    const accountsConfig = []

    // Advanced multi-account format with specific channel assignments:
    // ACCOUNTS=token1:channel1,channel2;token2:channel3,channel4
    if (process.env.ACCOUNTS) {
        const accountEntries = process.env.ACCOUNTS.split(';').map(e => e.trim()).filter(e => e)

        for (const entry of accountEntries) {
            const [token, channelsStr] = entry.split(':')
            if (!token || !channelsStr) {
                console.error(`[ERROR] Invalid account entry format: ${entry}`)
                continue
            }

            const channels = channelsStr.split(',').map(id => id.trim()).filter(id => id)
            accountsConfig.push({
                token: token.trim(),
                disboardChannels: channels,
                discadiaChannels: []
            })
        }

        return accountsConfig
    }

    // Simple multi-account format with automatic channel distribution:
    // TOKEN=token1,token2,token3
    // BUMP_CHANNELS=channel1,channel2,channel3,channel4,channel5
    // DISCADIA_CHANNELS=channel6,channel7,channel8
    if (process.env.TOKEN) {
        // Parse tokens (support both single and comma-separated)
        const tokens = process.env.TOKEN.split(',').map(t => t.trim()).filter(t => t)

        // Parse Disboard channels
        let disboardChannels = []
        if (process.env.BUMP_CHANNELS) {
            disboardChannels = process.env.BUMP_CHANNELS.split(',').map(id => id.trim()).filter(id => id)
        } else if (process.env.BUMP_CHANNEL) {
            console.log('[WARNING] BUMP_CHANNEL is deprecated. Please use BUMP_CHANNELS instead.')
            disboardChannels = [process.env.BUMP_CHANNEL.trim()]
        }

        // Parse Discadia channels
        let discadiaChannels = []
        if (process.env.DISCADIA_CHANNELS) {
            discadiaChannels = process.env.DISCADIA_CHANNELS.split(',').map(id => id.trim()).filter(id => id)
        }

        if (disboardChannels.length === 0 && discadiaChannels.length === 0) {
            throw new Error('No BUMP_CHANNELS or DISCADIA_CHANNELS found in .env file!')
        }

        // If single token, assign all channels to it (legacy behavior)
        if (tokens.length === 1) {
            return [{
                token: tokens[0],
                disboardChannels: disboardChannels,
                discadiaChannels: discadiaChannels
            }]
        }

        // Multiple tokens: each account will attempt all channels
        // This allows the bot to gracefully handle different access levels
        console.log(`[INFO] Distributing ${disboardChannels.length} Disboard channel(s) and ${discadiaChannels.length} Discadia channel(s) across ${tokens.length} account(s)`)
        console.log(`[INFO] Each account will attempt to access all channels`)

        for (const token of tokens) {
            accountsConfig.push({
                token: token,
                disboardChannels: [...disboardChannels],
                discadiaChannels: [...discadiaChannels]
            })
        }

        return accountsConfig
    }

    throw new Error('No ACCOUNTS or TOKEN configuration found in .env file!')
}

async function initializeAccounts() {
    const accountsConfig = parseAccountConfig()
    console.log(`[INFO] Initializing ${accountsConfig.length} account(s)...`)

    for (let i = 0; i < accountsConfig.length; i++) {
        const config = accountsConfig[i]
        const client = new Client()

        try {
            // Login the client
            await client.login(config.token)

            const account = {
                id: i,
                client: client,
                username: null, // Will be set after ready event
                lastDisboardBump: null, // Track Disboard bumps separately
                servers: []
            }

            accounts.push(account)
            console.log(`[INFO] Account ${i + 1} logged in, loading channels...`)

            let totalChannels = config.disboardChannels.length + config.discadiaChannels.length
            let loadedChannels = 0

            // Initialize Disboard servers for this account
            for (const channelId of config.disboardChannels) {
                try {
                    const channel = await client.channels.fetch(channelId)
                    const serverName = channel.guild ? channel.guild.name : `Channel ${channelId}`

                    const server = {
                        channelId: channelId,
                        channel: channel,
                        name: serverName,
                        service: 'disboard',
                        accountId: account.id,
                        account: account,
                        lastBump: null,
                        nextBump: new Date(), // Schedule immediately on startup
                        retryCount: 0
                    }

                    account.servers.push(server)
                    servers.push(server)
                    loadedChannels++

                    console.log(`[INFO] [Account ${i + 1}] Loaded Disboard: ${serverName} (${channelId})`)
                } catch (error) {
                    console.error(`[ERROR] [Account ${i + 1}] Failed to fetch Disboard channel ${channelId}: ${error.message}`)
                    console.log(`[INFO] [Account ${i + 1}] Skipping inaccessible channel ${channelId}`)
                }
            }

            // Initialize Discadia servers for this account
            for (const channelId of config.discadiaChannels) {
                try {
                    const channel = await client.channels.fetch(channelId)
                    const serverName = channel.guild ? channel.guild.name : `Channel ${channelId}`

                    const server = {
                        channelId: channelId,
                        channel: channel,
                        name: serverName,
                        service: 'discadia',
                        accountId: account.id,
                        account: account,
                        lastBump: null,
                        nextBump: new Date(), // Schedule immediately on startup
                        retryCount: 0
                    }

                    account.servers.push(server)
                    servers.push(server)
                    loadedChannels++

                    console.log(`[INFO] [Account ${i + 1}] Loaded Discadia: ${serverName} (${channelId})`)
                } catch (error) {
                    console.error(`[ERROR] [Account ${i + 1}] Failed to fetch Discadia channel ${channelId}: ${error.message}`)
                    console.log(`[INFO] [Account ${i + 1}] Skipping inaccessible channel ${channelId}`)
                }
            }

            // Set username after channels are loaded
            account.username = client.user.tag

            console.log(`[INFO] Account ${i + 1} (${account.username}): ${loadedChannels}/${totalChannels} channels accessible`)

        } catch (error) {
            console.error(`[ERROR] Failed to initialize account ${i + 1}: ${error.message}`)
        }
    }

    console.log(`[INFO] Successfully initialized ${accounts.length} account(s) with ${servers.length} total server(s)`)
}

async function performBump(server) {
    const now = new Date()
    const account = server.account

    try {
        // Determine which bot to use based on service type
        const botId = server.service === 'discadia' ? DISCADIA_BOT_ID : DISBOARD_BOT_ID
        await server.channel.sendSlash(botId, 'bump')

        // Update timestamps
        server.lastBump = now

        // Only update account cooldown for Disboard bumps
        if (server.service === 'disboard') {
            account.lastDisboardBump = now
        }

        // Schedule next bump based on service type
        let delay
        if (server.service === 'discadia') {
            delay = DISCADIA_COOLDOWN // 24 hours
        } else {
            delay = getRandomDelay(MIN_SERVER_COOLDOWN, MAX_SERVER_COOLDOWN) // 2-2.5 hours
        }

        server.nextBump = new Date(now.getTime() + delay)
        server.retryCount = 0

        console.log(`[${formatTime(now)}] [${account.username}] [${server.service.toUpperCase()}] [${server.name}] ✓ Bumped! Next bump at ${formatTime(server.nextBump)}`)

        // Only show account cooldown for Disboard bumps
        if (server.service === 'disboard') {
            console.log(`[${formatTime(now)}] [${account.username}] Disboard account cooldown until ${formatTime(new Date(now.getTime() + ACCOUNT_COOLDOWN))}`)
        }

        // Schedule the next bump check
        scheduleNextBump()

        return true
    } catch (error) {
        console.error(`[${formatTime(now)}] [${account.username}] [${server.service.toUpperCase()}] [${server.name}] ✗ Bump failed: ${error.message}`)

        // Retry logic - schedule retry in 5 minutes
        server.retryCount++
        server.nextBump = new Date(now.getTime() + 5 * 60 * 1000)
        console.log(`[${formatTime(now)}] [${account.username}] [${server.service.toUpperCase()}] [${server.name}] Retry #${server.retryCount} scheduled for ${formatTime(server.nextBump)}`)

        // Schedule the retry
        scheduleNextBump()

        return false
    }
}

function scheduleNextBump() {
    // Clear any existing timeout
    if (scheduledTimeout) {
        clearTimeout(scheduledTimeout)
        scheduledTimeout = null
    }

    const now = new Date()

    // Sort servers by next bump time (earliest first)
    const sortedServers = [...servers].sort((a, b) => a.nextBump - b.nextBump)

    // Find the next server that needs to be bumped
    for (const server of sortedServers) {
        let scheduledTime = server.nextBump
        const account = server.account

        // Only check account cooldown for Disboard bumps
        if (server.service === 'disboard' && account.lastDisboardBump) {
            const accountReadyTime = new Date(account.lastDisboardBump.getTime() + ACCOUNT_COOLDOWN)

            if (scheduledTime < accountReadyTime) {
                // Reschedule this server to after account cooldown
                if (server.nextBump < accountReadyTime) {
                    server.nextBump = accountReadyTime
                    console.log(`[${formatTime(now)}] [${account.username}] [DISBOARD] [${server.name}] Rescheduled to ${formatTime(server.nextBump)} due to account cooldown`)
                }
                scheduledTime = accountReadyTime
            }
        }

        // Calculate delay until this bump
        const delay = Math.max(0, scheduledTime - now)

        // Schedule the bump
        scheduledTimeout = setTimeout(() => {
            performBump(server)
        }, delay)

        const targetTime = new Date(now.getTime() + delay)
        console.log(`[${formatTime(now)}] Next bump: [${account.username}] [${server.service.toUpperCase()}] [${server.name}] at ${formatTime(targetTime)}`)

        // Only schedule the earliest bump, then return
        return
    }
}

function executeBump() {
    const now = new Date()

    // Sort servers by next bump time (earliest first)
    const sortedServers = [...servers].sort((a, b) => a.nextBump - b.nextBump)

    for (const server of sortedServers) {
        const account = server.account

        // Check if this server is ready to bump
        if (server.nextBump > now) {
            continue // Not ready yet
        }

        // Only check account cooldown for Disboard bumps
        if (server.service === 'disboard' && account.lastDisboardBump && (now - account.lastDisboardBump) < ACCOUNT_COOLDOWN) {
            continue // Still in Disboard account cooldown
        }

        // Check per-server cooldown based on service type
        if (server.lastBump) {
            const minCooldown = server.service === 'discadia' ? DISCADIA_COOLDOWN : MIN_SERVER_COOLDOWN
            if ((now - server.lastBump) < minCooldown) {
                continue
            }
        }

        // All checks passed - perform the bump
        performBump(server)
        return // Only bump one server, then return
    }

    // If we get here, no server was ready - reschedule
    scheduleNextBump()
}

// Main initialization
async function main() {
    try {
        console.log(`[${formatTime(new Date())}] Starting Disboard Auto Bump Bot...`)

        await initializeAccounts()

        if (accounts.length === 0) {
            console.error('[ERROR] No accounts initialized! Exiting...')
            process.exit(1)
        }

        if (servers.length === 0) {
            console.error('[ERROR] No servers to bump! Exiting...')
            process.exit(1)
        }

        // Start the scheduler
        console.log(`[${formatTime(new Date())}] Starting bump scheduler...`)

        // Schedule the first bump
        scheduleNextBump()

    } catch (error) {
        console.error(`[ERROR] Initialization failed: ${error.message}`)
        process.exit(1)
    }
}

// Start the bot
main()
