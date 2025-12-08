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
