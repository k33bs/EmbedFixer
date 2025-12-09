# EmbedFixer

A BetterDiscord plugin that automatically replaces social media links with better embed alternatives.

## Installation

1. Download `EmbedFixer.plugin.js`
2. Place it in your BetterDiscord plugins folder:
   - Windows: `%appdata%\BetterDiscord\plugins`
   - Mac: `~/Library/Application Support/BetterDiscord/plugins`
   - Linux: `~/.config/BetterDiscord/plugins`
3. Enable the plugin in Discord settings

## Features

### Embed Fixers
| Platform | Replacement |
|----------|-------------|
| X/Twitter | fixupx.com |
| Reddit | rxddit.com |
| TikTok | tnktok.com |
| Instagram | ddinstagram.com |
| Bluesky | bsyy.app |
| Threads | fixthreads.net |
| Pixiv | phixiv.net |
| Twitch Clips | fxtwitch.tv |
| Medium | scribe.rip |
| Tumblr | tpmblr.com |
| DeviantArt | fixdeviantart.com |
| 4chan | 4channel.org |

### Direct Media Links
- Giphy → direct GIF URLs
- Imgur → direct image URLs
- GitHub Gists → raw view
- Pastebin → raw text
- YouTube Shorts → regular video player
- Steam Store → SteamDB embeds

### URL Cleaning
- Strips 80+ tracking parameters (utm, fbclid, gclid, igshid, etc.)
- Removes Google/Bing AMP wrappers
- Cleans Amazon URLs to just the product ASIN

### Special Features
- **Edit Support** - Fixes links when editing messages, not just sending
- **Smart Edit Detection** - Won't re-fix if you're reverting a link back to original
- **Paywall Bypass** - Wraps paywalled articles (NYT, WSJ, Bloomberg, etc.) with archive.is, removepaywall.com, or 12ft.io
- **Song.link Integration** - Converts Spotify, Apple Music, YouTube Music links to universal song.link URLs

## Configuration

Open Discord Settings → Plugins → EmbedFixer → Settings to:
- Toggle individual platforms on/off
- Choose your preferred paywall bypass service
- Enable debug logging

## Notes

- Links inside code blocks are ignored
- All replacements happen before the message is sent
- Editing a message will also apply fixes (unless you're reverting)

## Development

### Running Tests

**Unit tests** (requires [Bun](https://bun.sh)):
```bash
bun test tests/embedfixer.test.js
```

**Integration tests** (in Discord Developer Console):
1. Open Discord Developer Console (Cmd+Option+I / Ctrl+Shift+I)
2. Paste contents of `tests/discord-console.js`
3. Run `eft.start()` for current channel or `eft.start("CHANNEL_ID")` for specific channel
4. Wait 6 seconds for safety warning, then tests will run

### Test Coverage
- 59 unit tests covering all URL transformations
- 58 integration test cases for real Discord message verification

## Changelog

### 0.5.0
- Now also fixes links when editing messages (not just sending)
- Smart edit detection: only skips re-fixing if you're reverting a fixed domain back to original
- Major performance improvement: tokenize message once instead of 7 times
- Pre-compile expensive regexes at startup instead of on every message
- Fixed song.link URL encoding to use proper encodeURIComponent
- Added type safety check for message content

### 0.4.0
- Added per-platform toggle settings - enable/disable individual fixers
- Added tracking parameter stripping (utm, fbclid, igshid, gclid, and 80+ more)
- Added AMP link removal - strips Google AMP wrapper from URLs
- Added song.link integration for Spotify, Apple Music, YouTube Music, etc.
- Added Amazon link cleaning - removes tracking garbage
- Added 12ft.io as a third paywall bypass option
- Added Steam store link embed support via SteamDB
- Completely redesigned settings panel with per-feature toggles

### 0.3.x
- Added error handling so one broken link won't stop others from being fixed
- Improved Giphy links reliability and speed
- Added protection against malicious URLs
- Fixed Pastebin links to properly show raw text
- Imgur links now correctly detect file types
- Links inside code blocks are now properly ignored
- Added paywall bypass service selection (Archive.is, RemovePaywall.com)

### 0.2.x
- Fixed compatibility issues with some Discord versions
- YouTube Shorts links now properly convert to regular videos
- Added debug mode setting

### 0.1.x
- Initial release with Twitter/X, Reddit, TikTok, Instagram, Pixiv support
- YouTube Shorts conversion
