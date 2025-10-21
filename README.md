# Discord Auto Bump Selfbot
[<img src="https://img.shields.io/github/license/appu1232/Discord-Selfbot.svg">](https://github.com/MonkoTubeYT/Disboard-Auto-Bump-Selfbot/blob/main/LICENSE)

A selfbot that automatically bumps on Disboard and Discadia.
# WARNING
Selfbots are against Discord's Terms of Service.
Which can be found at https://discord.com/guidelines and https://discord.com/terms

This code is strictly educational.

I am not liable for any accounts that get moderated by Discord due to the use of this selfbot.

# Setup

Open **.env** and configure:
```
TOKEN=
BUMP_CHANNELS=
DISCADIA_CHANNELS=
```

## Single Account Configuration

### Single Server
```
TOKEN=your_token_here
BUMP_CHANNELS=1234567890123456789
```

### Multiple Servers (Disboard only)
For multiple servers, separate channel IDs with commas:
```
TOKEN=your_token_here
BUMP_CHANNELS=1234567890123456789,9876543210987654321,1111222233334444555
```

### Multiple Servers (Disboard + Discadia)
You can configure both Disboard and Discadia bumping:
```
TOKEN=your_token_here
BUMP_CHANNELS=1234567890123456789,9876543210987654321
DISCADIA_CHANNELS=1234567890123456789,9876543210987654321
```

**Note:**
- The old `BUMP_CHANNEL` (singular) format is still supported for backward compatibility, but `BUMP_CHANNELS` is recommended.
- You can use the same channel IDs for both services - the bot will bump each service independently
- Discadia has a 24-hour cooldown and does NOT affect the Disboard 30-minute account cooldown

## Multi-Account Configuration (Simple)

The easiest way to use multiple accounts is to list all tokens and all channels:

```
TOKEN=token1,token2,token3
BUMP_CHANNELS=channel1,channel2,channel3,channel4,channel5
DISCADIA_CHANNELS=channel1,channel2,channel3
```

### How It Works:
- **Each account attempts to access ALL channels**
- If an account can't access a channel, it skips it gracefully
- Perfect for when accounts have different permissions
- Works independently for both Disboard and Discadia services

### Example:
```
TOKEN=ODY4OTQyMDg2MjYxNTg3OTg5.GFIsoP.example1,MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.GAbCdE.example2
BUMP_CHANNELS=1357478013159080198,2468013579246801357,3579246801357924680
DISCADIA_CHANNELS=1357478013159080198,2468013579246801357
```

**Result:**
- Account 1 will attempt Disboard channels: `1357478013159080198`, `2468013579246801357`, `3579246801357924680`
- Account 1 will attempt Discadia channels: `1357478013159080198`, `2468013579246801357`
- Account 2 will attempt Disboard channels: `1357478013159080198`, `2468013579246801357`, `3579246801357924680`
- Account 2 will attempt Discadia channels: `1357478013159080198`, `2468013579246801357`
- Channels that an account can't access are automatically skipped

### Benefits:
- **Simple Configuration**: Just list tokens and channels
- **Automatic Handling**: No need to manually assign channels to accounts
- **Isolated Cooldowns**: Each account has its own 30-minute Disboard cooldown (Discadia cooldowns are per-server, 24 hours)
- **Parallel Bumping**: Multiple accounts can bump different servers simultaneously
- **Independent Services**: Discadia bumps don't affect Disboard account cooldowns

## Advanced Multi-Account Configuration

For precise control over which account bumps which channels, use the **ACCOUNTS** format:

```
ACCOUNTS=token1:channel1,channel2,channel3;token2:channel4,channel5;token3:channel6
```

### Format:
- Each account is separated by a semicolon (`;`)
- For each account: `token:channel1,channel2,channel3`

### Example:
```
ACCOUNTS=ODY4OTQyMDg2MjYxNTg3OTg5.GFIsoP.example1:1357478013159080198,2468013579246801357;MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.GAbCdE.example2:3579246801357924680,4680135792468013579
```

This explicitly assigns:
- **Account 1** → channels `1357478013159080198`, `2468013579246801357`
- **Account 2** → channels `3579246801357924680`, `4680135792468013579`

# How Multi-Server Bumping Works

When using multiple servers, the bot intelligently manages bumps to respect both Disboard's and Discadia's rules:

## Disboard Bumping:
- **Per-Server Cooldown**: Each server is bumped every 2-2.5 hours (randomized to avoid detection)
- **Account Cooldown**: 30-minute cooldown per account between ANY Disboard bumps
- **Smart Scheduling**: If a server is ready to bump but the account cooldown is active, it will automatically reschedule
- **Error Handling**: Failed bumps are automatically retried after 5 minutes
- **Auto-Detection**: Server names are automatically detected from channel information

## Discadia Bumping:
- **Per-Server Cooldown**: Each server is bumped every 24 hours
- **No Account Cooldown**: Discadia bumps do NOT trigger or respect the 30-minute account cooldown
- **Independent Operation**: You can bump Discadia immediately after or before a Disboard bump
- **Error Handling**: Failed bumps are automatically retried after 5 minutes

## Single Account Timeline Example (Mixed Services):
```
12:00 - [DISBOARD] Server A bumped (Disboard account cooldown until 12:30)
12:05 - [DISCADIA] Server A bumped (no account cooldown!) ← Can bump immediately!
12:10 - [DISBOARD] Server B ready → rescheduled to 12:31 (Disboard account cooldown)
12:31 - [DISBOARD] Server B bumped (Disboard account cooldown until 13:01)
12:35 - [DISCADIA] Server C bumped (no account cooldown!)
14:15 - [DISBOARD] Server A bumped again
```

## Multi-Account Timeline Example:
```
12:00 - [Account 1] [DISBOARD] Server A bumped (Account 1 Disboard cooldown until 12:30)
12:05 - [Account 2] [DISBOARD] Server C bumped (Account 2 Disboard cooldown until 12:35)
12:10 - [Account 1] [DISCADIA] Server A bumped (no account cooldown!) ← Can bump immediately!
12:15 - [Account 1] [DISBOARD] Server B ready → rescheduled to 12:31 (Account 1 Disboard cooldown)
12:31 - [Account 1] [DISBOARD] Server B bumped
12:36 - [Account 2] [DISBOARD] Server D bumped
```

With multiple accounts and Discadia support, you can maximize your server's visibility across multiple listing platforms!

# How to get user token
1. Open Discord
2. Press `CTRL+SHIFT+I` to open the Developer Console
3. Copy and paste the code below into the console to automatically copy your user token to the clipboard.
```js
window.webpackChunkdiscord_app.push([
  [Math.random()],
  {},
  req => {
    if (!req.c) {
      console.error('req.c is undefined or null');
      return;
    }

    for (const m of Object.keys(req.c)
      .map(x => req.c[x].exports)
      .filter(x => x)) {
      if (m.default && m.default.getToken !== undefined) {
        return copy(m.default.getToken());
      }
      if (m.getToken !== undefined) {
        return copy(m.getToken());
      }
    }
  },
]);
console.log('%cWorked!', 'font-size: 50px');
console.log(`%cYou now have your token in the clipboard!`, 'font-size: 16px');
```
