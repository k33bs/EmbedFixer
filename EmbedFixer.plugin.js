/**
 * @name EmbedFixer
 * @version 0.5.0
 * @description Automatically replaces social media links with better embed alternatives
 * @author K33bs
 * @website https://github.com/k33bs/EmbedFixer
 * @updateUrl https://github.com/k33bs/EmbedFixer/blob/main/EmbedFixer.plugin.js
 * @changelogDate 2025-12-09
 * @changelog
 * ## 0.5.0
 * - Now also fixes links when editing messages (not just sending)
 * - Smart edit detection: only skips re-fixing if you're reverting a fixed domain back to original (e.g., fixupx.com → twitter.com)
 * - Major performance improvement: tokenize message once instead of 7 times
 * - Pre-compile expensive regexes at startup instead of on every message
 * - Fixed song.link URL encoding to use proper encodeURIComponent
 * - Added type safety check for message content
 * - Updated stop() to also restore editMessage
 * ## 0.4.0
 * - Added per-platform toggle settings - enable/disable individual fixers
 * - Added tracking parameter stripping (utm, fbclid, igshid, gclid, and 80+ more)
 * - Added AMP link removal - strips Google AMP wrapper from URLs (whitelist-based)
 * - Added song.link integration for Spotify, Apple Music, YouTube Music, etc.
 * - Added Amazon link cleaning - removes tracking garbage
 * - Added 12ft.io as a third paywall bypass option
 * - Added Steam store link embed support via SteamDB
 * - Completely redesigned settings panel with per-feature toggles
 * - Performance optimizations for tracking param stripping
 * ## 0.3.6
 * - Added error handling so one broken link won't stop others from being fixed
 * - Improved reliability when processing multiple different types of links
 * ## 0.3.5
 * - Made Giphy links more reliable and faster to process
 * - Added protection against malicious URLs that could freeze Discord
 * - Verified everything works with Discord's formatting (code blocks, spoilers, etc.)
 * - Improved performance when dealing with really long URLs
 * ## 0.3.4
 * - Fixed a major bug that was breaking Giphy, Imgur, and other special replacements
 * - Fixed issue where multiple Giphy links in one message weren't all converting
 * - Improved how the plugin detects where URLs end
 * - General reliability improvements for all link replacements
 * ## 0.3.3
 * - All links now use secure HTTPS connections
 * - Fixed Pastebin links to properly show raw text
 * - Imgur links now correctly detect file types (jpg, png, gif)
 * - Better handling of paywalled articles with special characters
 * - Links inside code blocks are now properly ignored
 * ## 0.3.2
 * - You can now choose between Archive.is and RemovePaywall.com for articles
 * - Added a settings option to pick your preferred paywall bypass service
 * - Updated the settings panel with clearer descriptions
 * ## 0.3.1
 * - Updated to better embed services for all platforms
 * - Added DeviantArt support with working embeds
 * - Simplified how Instagram links are handled
 * ## 0.3.0
 * - Added support for Twitch clips with proper embeds
 * - Medium articles now bypass the paywall automatically
 * - Added support for Bloomberg and Substack articles
 * - Tumblr posts now embed properly
 * - 4chan links now work correctly
 * - Tenor and Giphy links convert to direct GIF files
 * - GitHub Gists show raw code directly
 * - Pastebin links show raw text
 * - Imgur links go straight to the image
 * ## 0.2.1
 * - Fixed compatibility issues with some Discord versions
 * - YouTube Shorts links now properly convert to regular videos
 * - Better support across different BetterDiscord versions
 * ## 0.2.0
 * - Cleaned up duplicate code for better performance
 * - Added a settings panel where you can enable debug mode
 * ## 0.1.1
 * - Added Reddit support with working embeds
 * - Added TikTok support (including short links)
 * - Added Instagram support for posts and reels
 * - Added Pixiv artwork support
 * - YouTube Shorts now open in the regular player
 * - Better detection of URLs in your messages
 * ## 0.1.0
 * - First version of EmbedFixer
 * - Fixes Twitter/X links to show previews properly
 */

module.exports = class EmbedFixer {
	constructor() {
		// Initialize with defaults - actual values loaded in start()
		this.debugMode = false;
		this.paywallService = "archive";

		// Platform toggles - all enabled by default
		this.platformToggles = {
			twitter: true,
			reddit: true,
			tiktok: true,
			instagram: true,
			bluesky: true,
			threads: true,
			pixiv: true,
			twitch: true,
			medium: true,
			tumblr: true,
			deviantart: true,
			fourchan: true,
			giphy: true,
			gist: true,
			pastebin: true,
			imgur: true,
			youtubeShorts: true,
			paywall: true,
			trackingParams: true,
			ampLinks: true,
			songLink: true,
			amazonClean: true,
			steam: true,
		};

		// Pre-compile tracking params Set for performance (case-insensitive)
		this.trackingParamsSet = new Set(
			this.getTrackingParams().map((p) => p.toLowerCase())
		);
	}

	log(...args) {
		if (this.debugMode) {
			console.log("[EmbedFixer]", ...args);
		}
	}

	saveSettings() {
		BdApi.Data.save("EmbedFixer", "debugMode", this.debugMode);
		BdApi.Data.save("EmbedFixer", "paywallService", this.paywallService);
		BdApi.Data.save("EmbedFixer", "platformToggles", this.platformToggles);
	}

	loadSettings() {
		this.debugMode = BdApi.Data.load("EmbedFixer", "debugMode") ?? false;
		this.paywallService =
			BdApi.Data.load("EmbedFixer", "paywallService") ?? "archive";
		const savedToggles = BdApi.Data.load("EmbedFixer", "platformToggles");
		if (savedToggles) {
			// Merge with defaults to handle new platforms added in updates
			this.platformToggles = { ...this.platformToggles, ...savedToggles };
		}
	}

	// Pre-compile expensive regexes once at startup
	compileRegexes() {
		// Central embed replacements config - single source of truth
		// Each entry has: toggle key, pattern, replacement, name, original domains (for revert detection)
		this.embedReplacements = [
			{
				key: "twitter",
				pattern: /https?:\/\/(?:www\.)?(?:x|twitter)\.com/gi,
				replacement: "https://fixupx.com",
				name: "X/Twitter",
				originals: ["twitter.com", "x.com"],
				fixed: "fixupx.com",
			},
			{
				key: "reddit",
				pattern: /https?:\/\/(?:www\.)?reddit\.com/gi,
				replacement: "https://rxddit.com",
				name: "Reddit",
				originals: ["reddit.com"],
				fixed: "rxddit.com",
			},
			{
				key: "tiktok",
				pattern: /https?:\/\/(?:(?:www|m|vm|vt)\.)?tiktok\.com/gi,
				replacement: "https://tnktok.com",
				name: "TikTok",
				originals: ["tiktok.com"],
				fixed: "tnktok.com",
			},
			{
				key: "instagram",
				pattern: /https?:\/\/(?:www\.)?instagram\.com/gi,
				replacement: "https://ddinstagram.com",
				name: "Instagram",
				originals: ["instagram.com"],
				fixed: "ddinstagram.com",
			},
			{
				key: "bluesky",
				pattern: /https?:\/\/(?:www\.)?bsky\.app/gi,
				replacement: "https://bsyy.app",
				name: "Bluesky",
				originals: ["bsky.app"],
				fixed: "bsyy.app",
			},
			{
				key: "threads",
				pattern: /https?:\/\/(?:www\.)?threads\.net/gi,
				replacement: "https://fixthreads.net",
				name: "Threads",
				originals: ["threads.net"],
				fixed: "fixthreads.net",
			},
			{
				key: "pixiv",
				pattern: /https?:\/\/(?:www\.)?pixiv\.net/gi,
				replacement: "https://phixiv.net",
				name: "Pixiv",
				originals: ["pixiv.net"],
				fixed: "phixiv.net",
			},
			{
				key: "twitch",
				pattern: /https?:\/\/(?:www\.)?clips\.twitch\.tv/gi,
				replacement: "https://clips.fxtwitch.tv",
				name: "Twitch Clips",
				originals: ["clips.twitch.tv"],
				fixed: "clips.fxtwitch.tv",
			},
			{
				key: "medium",
				pattern: /https?:\/\/(?:www\.)?medium\.com/gi,
				replacement: "https://scribe.rip",
				name: "Medium",
				originals: ["medium.com"],
				fixed: "scribe.rip",
			},
			{
				key: "tumblr",
				pattern: /https?:\/\/(?:www\.)?tumblr\.com/gi,
				replacement: "https://tpmblr.com",
				name: "Tumblr",
				originals: ["tumblr.com"],
				fixed: "tpmblr.com",
			},
			{
				key: "deviantart",
				pattern: /https?:\/\/(?:www\.)?deviantart\.com/gi,
				replacement: "https://fixdeviantart.com",
				name: "DeviantArt",
				originals: ["deviantart.com"],
				fixed: "fixdeviantart.com",
			},
			{
				key: "fourchan",
				pattern: /https?:\/\/boards\.4chan\.org/gi,
				replacement: "https://boards.4channel.org",
				name: "4chan",
				originals: ["boards.4chan.org"],
				fixed: "boards.4channel.org",
			},
			{
				key: "giphy",
				pattern:
					/https?:\/\/(?:www\.)?giphy\.com\/gifs\/(?:[\w-]+-)?([a-zA-Z0-9]{8,20})(?:\/?(?=\s|$)|\/?$)/gi,
				replacement: (match, gifId) =>
					`https://media.giphy.com/media/${gifId}/giphy.gif`,
				name: "Giphy",
				originals: ["giphy.com/gifs"],
				fixed: "media.giphy.com/media",
			},
			{
				key: "gist",
				pattern:
					/https?:\/\/gist\.github\.com\/([a-zA-Z0-9-]+)\/([a-fA-F0-9]+)(?:\/[\w-]+)?(?:#.*)?/gi,
				replacement: "https://gist.githubusercontent.com/$1/$2/raw",
				name: "GitHub Gist",
				originals: ["gist.github.com"],
				fixed: "gist.githubusercontent.com",
			},
			{
				key: "pastebin",
				pattern: /https?:\/\/(?:www\.)?pastebin\.com\/(?!raw\/)([\w]+)/gi,
				replacement: "https://pastebin.com/raw/$1",
				name: "Pastebin",
				originals: [], // No revert detection - same domain
				fixed: "pastebin.com/raw",
			},
			{
				key: "imgur",
				pattern:
					/(https?:\/\/)(?:www\.)?imgur\.com\/(?!a\/|gallery\/)([\w]+)(?:\.(\w+))?/gi,
				replacement: (match, _proto, id, ext) =>
					"https://i.imgur.com/" + id + (ext ? "." + ext : ".png"),
				name: "Imgur",
				originals: ["imgur.com"],
				fixed: "i.imgur.com",
			},
			{
				key: "steam",
				pattern:
					/https?:\/\/store\.steampowered\.com\/app\/(\d+)(?:\/[^\s]*)?/gi,
				replacement: (match, appId) => `https://steamdb.info/app/${appId}/`,
				name: "Steam Store",
				originals: ["store.steampowered.com/app"],
				fixed: "steamdb.info/app",
			},
		];

		// AMP domains whitelist
		this.ampDomains = [
			"cnn",
			"bbc",
			"theguardian",
			"nytimes",
			"washingtonpost",
			"reuters",
			"forbes",
			"wired",
			"techcrunch",
			"theverge",
			"engadget",
			"arstechnica",
			"businessinsider",
			"huffpost",
			"nbcnews",
			"cbsnews",
			"abcnews",
			"usatoday",
			"time",
			"newsweek",
			"thehill",
			"politico",
			"vox",
			"slate",
			"salon",
			"dailymail",
			"independent",
			"telegraph",
			"mirror",
			"express",
			"standard",
			"9to5google",
			"9to5mac",
			"androidcentral",
			"tomsguide",
			"cnet",
			"zdnet",
		];
		const ampDomainsPattern = this.ampDomains.join("|");
		this.ampSubdomainRegex = new RegExp(
			`https?:\\/\\/amp\\.((?:${ampDomainsPattern})\\.\\w+)(\\/[^\\s]*)?`,
			"gi"
		);

		// Paywalled domains
		this.paywalledDomains = [
			"nytimes.com",
			"wsj.com",
			"washingtonpost.com",
			"ft.com",
			"economist.com",
			"theathletic.com",
			"businessinsider.com",
			"theatlantic.com",
			"newyorker.com",
			"wired.com",
			"vanityfair.com",
			"bloomberg.com",
			"barrons.com",
			"forbes.com",
			"fortune.com",
			"seekingalpha.com",
			"thedailybeast.com",
			"politico.com",
			"thetimes.co.uk",
			"telegraph.co.uk",
			"thesundaytimes.co.uk",
			"spectator.co.uk",
			"newstatesman.com",
			"lemonde.fr",
			"corriere.it",
			"bild.de",
			"spiegel.de",
			"nikkei.com",
			"haaretz.com",
			"scmp.com",
			"afr.com",
			"theage.com.au",
			"smh.com.au",
			"latimes.com",
			"chicagotribune.com",
			"bostonglobe.com",
			"sfchronicle.com",
			"seattletimes.com",
			"miamiherald.com",
			"denverpost.com",
			"startribune.com",
			"inquirer.com",
			"dallasnews.com",
			"theinformation.com",
			"stratechery.com",
			"protocol.com",
			"arstechnica.com",
			"harpers.org",
			"thenation.com",
			"foreignpolicy.com",
			"medium.com",
			"substack.com",
		];
		const domainPattern = this.paywalledDomains
			.map((d) => d.replace(/\./g, "\\."))
			.join("|");
		this.paywallRegex = new RegExp(
			`(https?:\\/\\/(?:[\\w-]+\\.)?(?:${domainPattern})\\/[^\\s]+?)((?:[\\.,!\\?\\)\\]\\}>\\\"]|&amp;)+)?(?=\\s|$)`,
			"gi"
		);

		// Music patterns for song.link
		this.musicPatterns = [
			/https?:\/\/open\.spotify\.com\/(track|album|playlist|artist)\/([a-zA-Z0-9]+)(\?[^\s]*)?/gi,
			/https?:\/\/music\.apple\.com\/[a-z]{2}\/(album|playlist|song|artist)\/[^\s]+/gi,
			/https?:\/\/music\.youtube\.com\/(watch\?v=|playlist\?list=|channel\/)[^\s]+/gi,
			/https?:\/\/(?:listen\.)?tidal\.com\/(track|album|playlist|artist)\/[^\s]+/gi,
			/https?:\/\/(?:www\.)?deezer\.com\/[a-z]{2}\/(track|album|playlist|artist)\/[^\s]+/gi,
			/https?:\/\/music\.amazon\.com\/[^\s]+/gi,
			/https?:\/\/soundcloud\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+(?:\?[^\s]*)?/gi,
		];

		// URL regex for tracking param stripping
		this.urlRegex = /(https?:\/\/[^\s<>\[\]()]+)/gi;

		// YouTube Shorts pattern
		this.ytShortsPattern =
			/https?:\/\/(?:(?:www|m)\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{5,})(\?[^\s]*)?/gi;

		// Trailing punctuation pattern (used in multiple methods)
		this.trailingPunctRegex = /([.,!?)\]}>]+)$/;

		// Amazon product URL patterns
		this.amazonProductRegex =
			/(https?:\/\/(?:www\.)?amazon\.(?:com|co\.uk|de|fr|it|es|ca|com\.au|co\.jp|in|com\.br|com\.mx|nl|se|pl|sg|ae|sa|eg|tr))\/(.*?\/)?(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:\/[^\s]*)?/gi;
		this.amazonTrackingRegex =
			/(https?:\/\/(?:www\.)?amazon\.[a-z.]+\/[^\s?]+)\?[^\s]*/gi;

		// AMP patterns
		this.googleAmpCacheRegex =
			/https?:\/\/(?:www\.)?google\.com\/amp\/s\/([^\s]+)/gi;
		this.googleAmpViewerRegex =
			/https?:\/\/(?:www\.)?google\.com\/amp\/([^\s]+)/gi;
		this.bingAmpRegex = /https?:\/\/(?:www\.)?bing\.com\/amp\/s\/([^\s]+)/gi;
		this.ampPathRegex = /(https?:\/\/[^\s\/]+)\/amp(\/[^\s]*)?/gi;

		// Code block tokenization pattern
		this.codeBlockRegex = /(```[\s\S]*?```|`[^`]*`)/g;
	}

	start() {
		this.loadSettings();
		this.compileRegexes();
		this.log("plugin started");

		// safely get the message module using the recommended getByKeys method
		const messageModule = BdApi.Webpack.getByKeys("sendMessage", "editMessage");
		if (!messageModule || !messageModule.sendMessage) {
			BdApi.UI.showToast("EmbedFixer: Failed to find sendMessage module", {
				type: "error",
			});
			console.error("[EmbedFixer] Could not find sendMessage module");
			return;
		}

		this.originalSendMessage = messageModule.sendMessage;
		this.originalEditMessage = messageModule.editMessage;

		// Helper to process message content - tokenizes once and processes all
		const processContent = (text) => {
			if (typeof text !== "string") return text;

			// Tokenize once: split by code blocks and inline code
			this.codeBlockRegex.lastIndex = 0;
			const parts = text.split(this.codeBlockRegex);

			const processedParts = parts.map((part) => {
				// Skip code blocks (they start with backtick)
				if (part.startsWith("`")) return part;

				let processed = part;

				// Strip tracking parameters first (cleanest URLs)
				if (this.platformToggles.trackingParams) {
					processed = this.stripTrackingParams(processed);
				}

				// Remove AMP wrappers
				if (this.platformToggles.ampLinks) {
					processed = this.removeAmpLinks(processed);
				}

				// Clean Amazon links
				if (this.platformToggles.amazonClean) {
					processed = this.cleanAmazonLinks(processed);
				}

				// Apply all the embed replacements
				processed = this.applyReplacements(processed);

				// Convert music links to song.link
				if (this.platformToggles.songLink) {
					processed = this.processSongLinks(processed);
				}

				// Wrap paywalled urls
				if (this.platformToggles.paywall) {
					processed = this.processPaywalls(processed);
				}

				// Handle youtube shorts
				if (this.platformToggles.youtubeShorts) {
					processed = this.processYouTubeShorts(processed);
				}

				return processed;
			});

			return processedParts.join("");
		};

		// Cache for tracking message content (for smart edit detection)
		this.messageContentCache = new Map();

		messageModule.sendMessage = async (channelId, content, ...args) => {
			try {
				if (content && typeof content.content === "string") {
					const originalContent = content.content;
					this.log("processing message:", originalContent);

					content.content = processContent(content.content);

					if (originalContent !== content.content) {
						this.log("final message:", content.content);
					} else {
						this.log("no changes made to message content.");
					}
				}
			} catch (error) {
				console.error("[EmbedFixer] Error processing message:", error);
			}

			const result = await this.originalSendMessage.call(
				messageModule,
				channelId,
				content,
				...args
			);

			// Cache the sent message content for edit comparison
			// Result contains the message ID after sending
			try {
				if (result && result.id && content && content.content) {
					this.messageContentCache.set(result.id, content.content);
					// Limit cache size to prevent memory issues
					if (this.messageContentCache.size > 100) {
						const firstKey = this.messageContentCache.keys().next().value;
						this.messageContentCache.delete(firstKey);
					}
				}
			} catch (e) {
				// Ignore caching errors
			}

			return result;
		};

		// Check if user is reverting: fixed domain disappeared AND its original appeared
		// Uses the central embedReplacements config
		const isRevertingFixedLink = (oldText, newText) => {
			for (const { fixed, originals } of this.embedReplacements) {
				if (!originals || originals.length === 0) continue;
				// Was the fixed domain in the old text?
				if (oldText.includes(fixed)) {
					// Is it gone now AND an original domain appeared?
					if (!newText.includes(fixed)) {
						for (const original of originals) {
							if (newText.includes(original) && !oldText.includes(original)) {
								return { fixed, original };
							}
						}
					}
				}
			}
			return null;
		};

		messageModule.editMessage = async (
			channelId,
			messageId,
			content,
			...args
		) => {
			try {
				if (content && typeof content.content === "string") {
					const newContent = content.content;
					const oldContent = this.messageContentCache.get(messageId) || "";

					// Check if user is intentionally reverting a fixed link
					const revert = isRevertingFixedLink(oldContent, newContent);
					if (revert) {
						this.log(
							`skipping edit - user reverted ${revert.fixed} to ${revert.original}`
						);
						// Update cache with the reverted content (don't re-fix on subsequent edits)
						this.messageContentCache.set(messageId, newContent);
					} else {
						this.log("processing edit:", newContent);
						content.content = processContent(newContent);

						if (newContent !== content.content) {
							this.log("final edit:", content.content);
						}
						// Cache the processed content
						this.messageContentCache.set(messageId, content.content);
					}
				}
			} catch (error) {
				console.error("[EmbedFixer] Error processing edit:", error);
			}

			return await this.originalEditMessage.call(
				messageModule,
				channelId,
				messageId,
				content,
				...args
			);
		};
	}

	// Tracking parameters to strip from URLs
	getTrackingParams() {
		return [
			// Google Analytics / UTM
			"utm_source",
			"utm_medium",
			"utm_campaign",
			"utm_term",
			"utm_content",
			"utm_cid",
			"utm_reader",
			"utm_referrer",
			"utm_name",
			"utm_social",
			"utm_social-type",
			"utm_brand",
			"utm_viz_id",
			"utm_pubreferrer",
			"utm_swu",
			"utm_int",
			"utm_hp_ref",
			"utm_klaviyo_id",
			// STM variants
			"stm_source",
			"stm_medium",
			"stm_campaign",
			"stm_term",
			"stm_content",
			// Facebook
			"fbclid",
			"fb_action_ids",
			"fb_action_types",
			"fb_source",
			"fb_ref",
			"fbc_id",
			"fb_beacon_info",
			// Instagram
			"igsh",
			"igshid",
			"ig_rid",
			"ig_mid",
			// Google Ads
			"gclid",
			"gclsrc",
			"gad_source",
			"gbraid",
			"wbraid",
			"dclid",
			// Microsoft/Bing
			"msclkid",
			"cvid",
			"oicd",
			// Twitter/X
			"twclid",
			"s",
			"t",
			"ref_src",
			"ref_url",
			// TikTok
			"_r",
			"is_copy_url",
			"is_from_webapp",
			"sender_device",
			"sender_web_id",
			// YouTube
			"si",
			"feature",
			"pp",
			"embeds_referring_euri",
			"source_ve_path",
			// Reddit
			"ref",
			"ref_source",
			"share_id",
			"rdt",
			// LinkedIn
			"trk",
			"trkInfo",
			"originalReferer",
			"li_fat_id",
			// Pinterest
			"epik",
			// Snapchat
			"sc_cid",
			// Mailchimp
			"mc_cid",
			"mc_eid",
			// HubSpot
			"_hsenc",
			"_hsmi",
			"hsa_acc",
			"hsa_cam",
			"hsa_grp",
			"hsa_ad",
			"hsa_src",
			"hsa_tgt",
			"hsa_kw",
			"hsa_mt",
			"hsa_net",
			"hsa_ver",
			// Adobe/Marketo
			"mkt_tok",
			"trk",
			"trkCampaign",
			"sc_cid",
			// Klaviyo
			"_kx",
			// Olytics
			"oly_anon_id",
			"oly_enc_id",
			"otc",
			// Wicked Reports
			"wickedid",
			// Yahoo
			"soc_src",
			"soc_trk",
			"_guc_consent_skip",
			// Yandex
			"_openstat",
			"yclid",
			"ymclid",
			// Other common tracking
			"ICID",
			"icid",
			"rb_clickid",
			"ncid",
			"nr_email_referer",
			"vero_id",
			"vero_conv",
			"_branch_match_id",
			"_bta_tid",
			"_bta_c",
			"trk_contact",
			"trk_msg",
			"trk_module",
			"trk_sid",
			"gdfms",
			"gdftrk",
			"gdffi",
			"_ga",
			"_gl",
			"_ke",
			"dm_i",
			"dm_t",
			"ef_id",
			"s_kwcid",
			"__s",
			"at_xt",
			"at_xt_click",
			"at_xt_send",
			"at_xt_submit",
			"elqTrackId",
			"elqTrack",
			"assetId",
			"assetType",
			"recipientId",
			"campaignId",
			"siteId",
			"cvo_campaign",
			"cvo_crid",
		];
	}

	stripTrackingParams(segment) {
		this.urlRegex.lastIndex = 0;
		return segment.replace(this.urlRegex, (url) => {
			try {
				let trailingPunct = "";
				const punctMatch = url.match(this.trailingPunctRegex);
				if (punctMatch) {
					trailingPunct = punctMatch[1];
					url = url.slice(0, -trailingPunct.length);
				}

				const urlObj = new URL(url);
				const paramsToDelete = [];
				urlObj.searchParams.forEach((_, key) => {
					if (this.trackingParamsSet.has(key.toLowerCase())) {
						paramsToDelete.push(key);
					}
				});

				if (paramsToDelete.length > 0) {
					paramsToDelete.forEach((p) => urlObj.searchParams.delete(p));
					this.log("stripped tracking params from:", url);
					let cleanUrl = urlObj.toString();
					if (cleanUrl.endsWith("?")) {
						cleanUrl = cleanUrl.slice(0, -1);
					}
					return cleanUrl + trailingPunct;
				}
				return url + trailingPunct;
			} catch (e) {
				return url;
			}
		});
	}

	removeAmpLinks(segment) {
		// Google AMP cache
		this.googleAmpCacheRegex.lastIndex = 0;
		segment = segment.replace(this.googleAmpCacheRegex, (match, url) => {
			this.log("removed Google AMP wrapper");
			return "https://" + url;
		});

		// Google AMP viewer
		this.googleAmpViewerRegex.lastIndex = 0;
		segment = segment.replace(this.googleAmpViewerRegex, (match, url) => {
			this.log("removed Google AMP wrapper");
			if (!url.startsWith("http")) {
				return "https://" + url;
			}
			return url;
		});

		// Bing AMP cache
		this.bingAmpRegex.lastIndex = 0;
		segment = segment.replace(this.bingAmpRegex, (match, url) => {
			this.log("removed Bing AMP wrapper");
			return "https://" + url;
		});

		// amp. subdomain URLs
		this.ampSubdomainRegex.lastIndex = 0;
		segment = segment.replace(this.ampSubdomainRegex, (match, domain, path) => {
			this.log("removed amp. subdomain from:", domain);
			return "https://" + domain + (path || "");
		});

		// /amp/ in path
		this.ampPathRegex.lastIndex = 0;
		segment = segment.replace(this.ampPathRegex, (match, base, path) => {
			this.log("removed /amp/ from path");
			return base + (path || "");
		});

		return segment;
	}

	cleanAmazonLinks(segment) {
		this.amazonProductRegex.lastIndex = 0;
		segment = segment.replace(
			this.amazonProductRegex,
			(match, domain, _middle, asin) => {
				this.log("cleaned Amazon link, ASIN:", asin);
				return `${domain}/dp/${asin}`;
			}
		);

		this.amazonTrackingRegex.lastIndex = 0;
		segment = segment.replace(this.amazonTrackingRegex, (match, baseUrl) => {
			if (baseUrl.includes("/dp/") || baseUrl.includes("/gp/")) {
				this.log("stripped Amazon tracking params");
				return baseUrl;
			}
			return match;
		});

		return segment;
	}

	processSongLinks(segment) {
		for (const pattern of this.musicPatterns) {
			pattern.lastIndex = 0;
			segment = segment.replace(pattern, (match) => {
				let trailing = "";
				const punctMatch = match.match(this.trailingPunctRegex);
				if (punctMatch) {
					trailing = punctMatch[1];
					match = match.slice(0, -trailing.length);
				}

				this.log("converted to song.link:", match);
				return `https://song.link/${encodeURIComponent(match)}${trailing}`;
			});
		}
		return segment;
	}

	applyReplacements(segment) {
		// Filter to only enabled replacements
		const activeReplacements = this.embedReplacements.filter(
			({ key }) => this.platformToggles[key]
		);

		if (activeReplacements.length === 0) return segment;

		return activeReplacements.reduce((acc, { pattern, replacement, name }) => {
			try {
				pattern.lastIndex = 0;
				return acc.replace(pattern, replacement);
			} catch (error) {
				console.error(`[EmbedFixer] Error in ${name} replacement:`, error);
				return acc;
			}
		}, segment);
	}

	processPaywalls(segment) {
		this.paywallRegex.lastIndex = 0;
		return segment.replace(
			this.paywallRegex,
			(match, urlCore, trailing, offset, src) => {
				const before = src.slice(0, offset);
				if (
					/(?:archive\.is|removepaywall\.com|12ft\.io)\/?$/i.test(
						before.slice(-40)
					)
				) {
					return match;
				}
				if (
					src.charAt(offset - 1) === "(" &&
					trailing &&
					trailing.startsWith(")")
				) {
					return match;
				}

				let wrapped;
				switch (this.paywallService) {
					case "removepaywall":
						wrapped = `https://www.removepaywall.com/search?url=${encodeURIComponent(
							urlCore
						)}`;
						break;
					case "12ft":
						wrapped = `https://12ft.io/${urlCore}`;
						break;
					default:
						wrapped = `https://archive.is/${urlCore}`;
				}
				return `${wrapped}${trailing || ""}`;
			}
		);
	}

	processYouTubeShorts(segment) {
		this.ytShortsPattern.lastIndex = 0;
		return segment.replace(this.ytShortsPattern, (m, id, queryParams) => {
			const params = queryParams || "";
			const paramString =
				params && params.length > 1 ? "&" + params.substring(1) : "";
			this.log("converted youtube shorts -> full player");
			return `https://youtube.com/watch?v=${id}${paramString}`;
		});
	}

	stop() {
		try {
			const messageModule = BdApi.Webpack.getByKeys(
				"sendMessage",
				"editMessage"
			);
			if (messageModule) {
				if (this.originalSendMessage) {
					messageModule.sendMessage = this.originalSendMessage;
				}
				if (this.originalEditMessage) {
					messageModule.editMessage = this.originalEditMessage;
				}
				this.log("plugin stopped successfully");
			}
		} catch (error) {
			console.error("[EmbedFixer] Error stopping plugin:", error);
		}
	}

	// Settings panel
	getSettingsPanel() {
		const panel = document.createElement("div");
		panel.style.padding = "16px";
		panel.style.color = "var(--text-normal)";

		// Helper to create a section header
		const createHeader = (text) => {
			const header = document.createElement("h3");
			header.textContent = text;
			header.style.marginTop = "16px";
			header.style.marginBottom = "8px";
			header.style.color = "var(--header-primary)";
			header.style.fontSize = "16px";
			header.style.fontWeight = "600";
			return header;
		};

		// Helper to create a toggle row
		const createToggle = (label, key, description) => {
			const row = document.createElement("div");
			row.style.display = "flex";
			row.style.alignItems = "center";
			row.style.justifyContent = "space-between";
			row.style.padding = "8px 0";
			row.style.borderBottom = "1px solid var(--background-modifier-accent)";

			const labelContainer = document.createElement("div");
			labelContainer.style.flex = "1";

			const labelText = document.createElement("div");
			labelText.textContent = label;
			labelText.style.fontWeight = "500";
			labelContainer.appendChild(labelText);

			if (description) {
				const desc = document.createElement("div");
				desc.textContent = description;
				desc.style.fontSize = "12px";
				desc.style.color = "var(--text-muted)";
				desc.style.marginTop = "2px";
				labelContainer.appendChild(desc);
			}

			const toggle = document.createElement("input");
			toggle.type = "checkbox";
			toggle.checked = this.platformToggles[key];
			toggle.style.width = "20px";
			toggle.style.height = "20px";
			toggle.style.cursor = "pointer";
			toggle.onchange = () => {
				this.platformToggles[key] = toggle.checked;
				this.saveSettings();
			};

			row.appendChild(labelContainer);
			row.appendChild(toggle);
			return row;
		};

		// Debug mode toggle
		panel.appendChild(createHeader("General Settings"));

		const debugRow = document.createElement("div");
		debugRow.style.display = "flex";
		debugRow.style.alignItems = "center";
		debugRow.style.justifyContent = "space-between";
		debugRow.style.padding = "8px 0";
		debugRow.style.borderBottom = "1px solid var(--background-modifier-accent)";

		const debugLabel = document.createElement("div");
		debugLabel.textContent = "Debug Logging";
		debugLabel.style.fontWeight = "500";

		const debugToggle = document.createElement("input");
		debugToggle.type = "checkbox";
		debugToggle.checked = this.debugMode;
		debugToggle.style.width = "20px";
		debugToggle.style.height = "20px";
		debugToggle.style.cursor = "pointer";
		debugToggle.onchange = () => {
			this.debugMode = debugToggle.checked;
			this.saveSettings();
		};

		debugRow.appendChild(debugLabel);
		debugRow.appendChild(debugToggle);
		panel.appendChild(debugRow);

		// Paywall service selector
		const paywallRow = document.createElement("div");
		paywallRow.style.display = "flex";
		paywallRow.style.alignItems = "center";
		paywallRow.style.justifyContent = "space-between";
		paywallRow.style.padding = "8px 0";
		paywallRow.style.borderBottom =
			"1px solid var(--background-modifier-accent)";

		const paywallLabel = document.createElement("div");
		paywallLabel.textContent = "Paywall Bypass Service";
		paywallLabel.style.fontWeight = "500";

		const paywallSelect = document.createElement("select");
		paywallSelect.style.padding = "4px 8px";
		paywallSelect.style.borderRadius = "4px";
		paywallSelect.style.border = "1px solid var(--background-modifier-accent)";
		paywallSelect.style.background = "var(--background-secondary)";
		paywallSelect.style.color = "var(--text-normal)";

		[
			{ value: "archive", text: "Archive.is" },
			{ value: "removepaywall", text: "RemovePaywall.com" },
			{ value: "12ft", text: "12ft.io" },
		].forEach(({ value, text }) => {
			const opt = document.createElement("option");
			opt.value = value;
			opt.textContent = text;
			paywallSelect.appendChild(opt);
		});

		paywallSelect.value = this.paywallService;
		paywallSelect.onchange = () => {
			this.paywallService = paywallSelect.value;
			this.saveSettings();
		};

		paywallRow.appendChild(paywallLabel);
		paywallRow.appendChild(paywallSelect);
		panel.appendChild(paywallRow);

		// URL Cleaning section
		panel.appendChild(createHeader("URL Cleaning"));
		panel.appendChild(
			createToggle(
				"Strip Tracking Parameters",
				"trackingParams",
				"Remove utm_, fbclid, igshid, gclid, etc."
			)
		);
		panel.appendChild(
			createToggle("Remove AMP Links", "ampLinks", "Unwrap Google AMP URLs")
		);
		panel.appendChild(
			createToggle(
				"Clean Amazon Links",
				"amazonClean",
				"Remove tracking from Amazon URLs"
			)
		);

		// Embed Fixers section
		panel.appendChild(createHeader("Social Media Embed Fixers"));
		panel.appendChild(createToggle("X/Twitter", "twitter", "fixupx.com"));
		panel.appendChild(createToggle("Reddit", "reddit", "rxddit.com"));
		panel.appendChild(createToggle("TikTok", "tiktok", "tnktok.com"));
		panel.appendChild(
			createToggle("Instagram", "instagram", "ddinstagram.com")
		);
		panel.appendChild(createToggle("Bluesky", "bluesky", "bsyy.app"));
		panel.appendChild(createToggle("Threads", "threads", "fixthreads.net"));
		panel.appendChild(createToggle("Pixiv", "pixiv", "phixiv.net"));
		panel.appendChild(createToggle("Twitch Clips", "twitch", "fxtwitch.tv"));
		panel.appendChild(createToggle("Tumblr", "tumblr", "tpmblr.com"));
		panel.appendChild(
			createToggle("DeviantArt", "deviantart", "fixdeviantart.com")
		);

		// Media & Content section
		panel.appendChild(createHeader("Media & Content"));
		panel.appendChild(createToggle("Giphy", "giphy", "Direct GIF links"));
		panel.appendChild(createToggle("Imgur", "imgur", "Direct image links"));
		panel.appendChild(createToggle("GitHub Gists", "gist", "Raw code view"));
		panel.appendChild(createToggle("Pastebin", "pastebin", "Raw text view"));
		panel.appendChild(
			createToggle(
				"YouTube Shorts",
				"youtubeShorts",
				"Convert to regular player"
			)
		);
		panel.appendChild(
			createToggle("Steam Store", "steam", "Better embeds via SteamDB")
		);

		// Special Features section
		panel.appendChild(createHeader("Special Features"));
		panel.appendChild(
			createToggle("Medium/Scribe", "medium", "Bypass Medium paywall")
		);
		panel.appendChild(
			createToggle("Paywall Bypass", "paywall", "NYT, WSJ, Bloomberg, etc.")
		);
		panel.appendChild(createToggle("4chan", "fourchan", "Use 4channel.org"));
		panel.appendChild(
			createToggle("Song.link", "songLink", "Universal music links")
		);

		return panel;
	}
};
