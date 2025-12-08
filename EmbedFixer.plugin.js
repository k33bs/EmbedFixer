/**
 * @name EmbedFixer
 * @version 0.4.0
 * @description Automatically replaces social media links with better embed alternatives
 * @author K33bs
 * @website https://github.com/k33bs/EmbedFixer
 * @updateUrl https://github.com/k33bs/EmbedFixer/blob/main/EmbedFixer.plugin.js
 * @changelogDate 2025-12-08
 * @changelog
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

	start() {
		this.loadSettings();
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

		messageModule.sendMessage = async (channelId, content, ...args) => {
			try {
				if (content && content.content) {
					const originalContent = content.content;
					this.log("processing message:", originalContent);

					// Strip tracking parameters first (cleanest URLs)
					if (this.platformToggles.trackingParams) {
						content.content = this.stripTrackingParams(content.content);
					}

					// Remove AMP wrappers
					if (this.platformToggles.ampLinks) {
						content.content = this.removeAmpLinks(content.content);
					}

					// Clean Amazon links
					if (this.platformToggles.amazonClean) {
						content.content = this.cleanAmazonLinks(content.content);
					}

					// Apply all the embed replacements
					content.content = this.applyReplacements(content.content);

					// Convert music links to song.link
					if (this.platformToggles.songLink) {
						content.content = this.processSongLinks(content.content);
					}

					// Wrap paywalled urls
					if (this.platformToggles.paywall) {
						content.content = this.processPaywalls(content.content);
					}

					// Handle youtube shorts
					if (this.platformToggles.youtubeShorts) {
						content.content = this.processYouTubeShorts(content.content);
					}

					// Log final result if we changed anything
					if (originalContent !== content.content) {
						this.log("final message:", content.content);
					} else {
						this.log("no changes made to message content.");
					}
				}
			} catch (error) {
				console.error("[EmbedFixer] Error processing message:", error);
				// just continue with original message if something breaks
			}

			// always return the result of the original function (bind to original module)
			return await this.originalSendMessage.call(
				messageModule,
				channelId,
				content,
				...args
			);
		};
	}

	// helper: apply replacements only outside code blocks (``` ... ```)
	// and inline code (`...`).
	replaceOutsideCode(text, replacer) {
		if (!text) return text;
		const fenceSplit = text.split(/```/);
		for (let i = 0; i < fenceSplit.length; i++) {
			// even indices are outside fenced code
			if (i % 2 === 0) {
				const segment = fenceSplit[i];
				const inlineSplit = segment.split(/`/);
				// If backticks are unbalanced, avoid inline toggling and process segment as a whole
				if (inlineSplit.length % 2 !== 1) {
					fenceSplit[i] = replacer(segment);
				} else {
					for (let j = 0; j < inlineSplit.length; j++) {
						// even indices are outside inline code
						if (j % 2 === 0) {
							inlineSplit[j] = replacer(inlineSplit[j]);
						}
					}
					fenceSplit[i] = inlineSplit.join("`");
				}
			}
		}
		return fenceSplit.join("```");
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

	stripTrackingParams(content) {
		// Match URLs and strip tracking params
		const urlRegex = /(https?:\/\/[^\s<>\[\]()]+)/gi;

		const newContent = this.replaceOutsideCode(content, (segment) => {
			return segment.replace(urlRegex, (url) => {
				try {
					// Handle URLs that might end with punctuation
					let trailingPunct = "";
					const punctMatch = url.match(/([.,!?)\]}>]+)$/);
					if (punctMatch) {
						trailingPunct = punctMatch[1];
						url = url.slice(0, -trailingPunct.length);
					}

					const urlObj = new URL(url);

					// Optimized: iterate URL's params and check against Set (case-insensitive)
					const paramsToDelete = [];
					urlObj.searchParams.forEach((_, key) => {
						if (this.trackingParamsSet.has(key.toLowerCase())) {
							paramsToDelete.push(key);
						}
					});

					if (paramsToDelete.length > 0) {
						paramsToDelete.forEach((p) => urlObj.searchParams.delete(p));
						this.log("stripped tracking params from:", url);
						// Remove trailing ? if no params left
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
		});

		return newContent;
	}

	removeAmpLinks(content) {
		const newContent = this.replaceOutsideCode(content, (segment) => {
			// Google AMP cache: https://www.google.com/amp/s/example.com/article
			segment = segment.replace(
				/https?:\/\/(?:www\.)?google\.com\/amp\/s\/([^\s]+)/gi,
				(match, url) => {
					this.log("removed Google AMP wrapper");
					return "https://" + url;
				}
			);

			// Google AMP viewer: https://www.google.com/amp/example.com/article
			segment = segment.replace(
				/https?:\/\/(?:www\.)?google\.com\/amp\/([^\s]+)/gi,
				(match, url) => {
					this.log("removed Google AMP wrapper");
					// Add https:// if not present
					if (!url.startsWith("http")) {
						return "https://" + url;
					}
					return url;
				}
			);

			// Bing AMP cache
			segment = segment.replace(
				/https?:\/\/(?:www\.)?bing\.com\/amp\/s\/([^\s]+)/gi,
				(match, url) => {
					this.log("removed Bing AMP wrapper");
					return "https://" + url;
				}
			);

			// amp. subdomain URLs - only for known news/media domains that use AMP
			// This whitelist approach prevents breaking legitimate amp.* domains
			const ampDomains = [
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
			const ampDomainsPattern = ampDomains.join("|");
			segment = segment.replace(
				new RegExp(
					`https?:\\/\\/amp\\.((?:${ampDomainsPattern})\\.\\w+)(\\/[^\\s]*)?`,
					"gi"
				),
				(match, domain, path) => {
					this.log("removed amp. subdomain from:", domain);
					return "https://" + domain + (path || "");
				}
			);

			// /amp/ in path
			segment = segment.replace(
				/(https?:\/\/[^\s\/]+)\/amp(\/[^\s]*)?/gi,
				(match, base, path) => {
					this.log("removed /amp/ from path");
					return base + (path || "");
				}
			);

			return segment;
		});

		return newContent;
	}

	cleanAmazonLinks(content) {
		const newContent = this.replaceOutsideCode(content, (segment) => {
			// Match Amazon product URLs and simplify them
			// Supports: amazon.com, amazon.co.uk, amazon.de, amazon.fr, etc.
			const amazonRegex =
				/(https?:\/\/(?:www\.)?amazon\.(?:com|co\.uk|de|fr|it|es|ca|com\.au|co\.jp|in|com\.br|com\.mx|nl|se|pl|sg|ae|sa|eg|tr))\/(.*?\/)?(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:\/[^\s]*)?/gi;

			segment = segment.replace(amazonRegex, (match, domain, _middle, asin) => {
				this.log("cleaned Amazon link, ASIN:", asin);
				return `${domain}/dp/${asin}`;
			});

			// Also handle amzn.to and amzn.com short links - can't expand them client-side
			// but we can at least strip ref params from regular amazon links
			segment = segment.replace(
				/(https?:\/\/(?:www\.)?amazon\.[a-z.]+\/[^\s?]+)\?[^\s]*/gi,
				(match, baseUrl) => {
					// Keep the base URL, strip all query params (they're all tracking)
					if (baseUrl.includes("/dp/") || baseUrl.includes("/gp/")) {
						this.log("stripped Amazon tracking params");
						return baseUrl;
					}
					return match;
				}
			);

			return segment;
		});

		return newContent;
	}

	processSongLinks(content) {
		// Convert music streaming URLs to song.link for universal sharing
		const musicPatterns = [
			// Spotify
			/https?:\/\/open\.spotify\.com\/(track|album|playlist|artist)\/([a-zA-Z0-9]+)(\?[^\s]*)?/gi,
			// Apple Music
			/https?:\/\/music\.apple\.com\/[a-z]{2}\/(album|playlist|song|artist)\/[^\s]+/gi,
			// YouTube Music
			/https?:\/\/music\.youtube\.com\/(watch\?v=|playlist\?list=|channel\/)[^\s]+/gi,
			// Tidal
			/https?:\/\/(?:listen\.)?tidal\.com\/(track|album|playlist|artist)\/[^\s]+/gi,
			// Deezer
			/https?:\/\/(?:www\.)?deezer\.com\/[a-z]{2}\/(track|album|playlist|artist)\/[^\s]+/gi,
			// Amazon Music
			/https?:\/\/music\.amazon\.com\/[^\s]+/gi,
			// SoundCloud (tracks only, not profiles)
			/https?:\/\/soundcloud\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+(?:\?[^\s]*)?/gi,
		];

		let newContent = content;

		newContent = this.replaceOutsideCode(newContent, (segment) => {
			for (const pattern of musicPatterns) {
				pattern.lastIndex = 0;
				segment = segment.replace(pattern, (match) => {
					// Clean trailing punctuation
					let trailing = "";
					const punctMatch = match.match(/([.,!?)\]}>]+)$/);
					if (punctMatch) {
						trailing = punctMatch[1];
						match = match.slice(0, -trailing.length);
					}

					this.log("converted to song.link:", match);
					// song.link expects the URL as a path segment, not query param
					// Use encodeURIComponent but only on the parts that need it
					// The URL is already percent-encoded, so we just need to escape
					// characters that are special in URL paths (/, ?, #, etc.)
					const encodedUrl = match
						.replace(/%/g, "%25") // Escape existing percent signs first
						.replace(/\?/g, "%3F") // Escape query string marker
						.replace(/#/g, "%23") // Escape fragment marker
						.replace(/&/g, "%26"); // Escape ampersands
					return `https://song.link/${encodedUrl}${trailing}`;
				});
			}
			return segment;
		});

		return newContent;
	}

	applyReplacements(content) {
		const replacements = [];

		// Only add replacements for enabled platforms
		if (this.platformToggles.twitter) {
			replacements.push({
				pattern: /https?:\/\/(?:www\.)?(?:x|twitter)\.com/gi,
				replacement: "https://fixupx.com",
				name: "X/Twitter",
			});
		}

		if (this.platformToggles.reddit) {
			replacements.push({
				pattern: /https?:\/\/(?:www\.)?reddit\.com/gi,
				replacement: "https://rxddit.com",
				name: "Reddit",
			});
		}

		if (this.platformToggles.tiktok) {
			replacements.push({
				pattern: /https?:\/\/(?:(?:www|m|vm|vt)\.)?tiktok\.com/gi,
				replacement: "https://tnktok.com",
				name: "TikTok",
			});
		}

		if (this.platformToggles.instagram) {
			replacements.push({
				pattern: /https?:\/\/(?:www\.)?instagram\.com/gi,
				replacement: "https://ddinstagram.com",
				name: "Instagram",
			});
		}

		if (this.platformToggles.bluesky) {
			replacements.push({
				pattern: /https?:\/\/(?:www\.)?bsky\.app/gi,
				replacement: "https://bsyy.app",
				name: "Bluesky",
			});
		}

		if (this.platformToggles.threads) {
			replacements.push({
				pattern: /https?:\/\/(?:www\.)?threads\.net/gi,
				replacement: "https://fixthreads.net",
				name: "Threads",
			});
		}

		if (this.platformToggles.pixiv) {
			replacements.push({
				pattern: /https?:\/\/(?:www\.)?pixiv\.net/gi,
				replacement: "https://phixiv.net",
				name: "Pixiv",
			});
		}

		if (this.platformToggles.twitch) {
			replacements.push({
				pattern: /https?:\/\/(?:www\.)?clips\.twitch\.tv/gi,
				replacement: "https://clips.fxtwitch.tv",
				name: "Twitch Clips",
			});
		}

		if (this.platformToggles.medium) {
			replacements.push({
				pattern: /https?:\/\/(?:www\.)?medium\.com/gi,
				replacement: "https://scribe.rip",
				name: "Medium",
			});
		}

		if (this.platformToggles.tumblr) {
			replacements.push({
				pattern: /https?:\/\/(?:www\.)?tumblr\.com/gi,
				replacement: "https://tpmblr.com",
				name: "Tumblr",
			});
		}

		if (this.platformToggles.deviantart) {
			replacements.push({
				pattern: /https?:\/\/(?:www\.)?deviantart\.com/gi,
				replacement: "https://fixdeviantart.com",
				name: "DeviantArt",
			});
		}

		if (this.platformToggles.fourchan) {
			replacements.push({
				pattern: /https?:\/\/boards\.4chan\.org/gi,
				replacement: "https://boards.4channel.org",
				name: "4chan",
			});
		}

		if (this.platformToggles.giphy) {
			replacements.push({
				pattern:
					/https?:\/\/(?:www\.)?giphy\.com\/gifs\/(?:[\w-]+-)?([a-zA-Z0-9]{8,20})(?:\/?(?=\s|$)|\/?$)/gi,
				replacement: (match, gifId) =>
					`https://media.giphy.com/media/${gifId}/giphy.gif`,
				name: "Giphy",
			});
		}

		// Note: Tenor support removed - the view page ID doesn't match the CDN media ID,
		// so we can't reliably convert tenor.com/view URLs to direct GIF links

		if (this.platformToggles.gist) {
			replacements.push({
				pattern:
					/https?:\/\/gist\.github\.com\/([a-zA-Z0-9-]+)\/([a-fA-F0-9]+)(?:\/[\w-]+)?(?:#.*)?/gi,
				replacement: "https://gist.githubusercontent.com/$1/$2/raw",
				name: "GitHub Gist",
			});
		}

		if (this.platformToggles.pastebin) {
			replacements.push({
				pattern: /https?:\/\/(?:www\.)?pastebin\.com\/(?!raw\/)([\w]+)/gi,
				replacement: "https://pastebin.com/raw/$1",
				name: "Pastebin",
			});
		}

		if (this.platformToggles.imgur) {
			replacements.push({
				pattern:
					/(https?:\/\/)(?:www\.)?imgur\.com\/(?!a\/|gallery\/)([\w]+)(?:\.(\w+))?/gi,
				replacement: (match, _proto, id, ext) => {
					return "https://i.imgur.com/" + id + (ext ? "." + ext : ".png");
				},
				name: "Imgur",
			});
		}

		if (this.platformToggles.steam) {
			// Steam store links - convert to steamdb for better embeds
			replacements.push({
				pattern:
					/https?:\/\/store\.steampowered\.com\/app\/(\d+)(?:\/[^\s]*)?/gi,
				replacement: (match, appId) => `https://steamdb.info/app/${appId}/`,
				name: "Steam Store",
			});
		}

		if (replacements.length === 0) {
			return content;
		}

		const changed = new Set();
		const newContent = this.replaceOutsideCode(content, (segment) => {
			// Pre-mark which patterns are present in this segment for logging
			replacements.forEach(({ pattern, name }) => {
				pattern.lastIndex = 0;
				if (pattern.test(segment)) changed.add(name);
			});

			// Apply chained replacements in one pass over this segment
			return replacements.reduce((acc, { pattern, replacement, name }) => {
				try {
					pattern.lastIndex = 0;
					return acc.replace(pattern, replacement);
				} catch (error) {
					console.error(`[EmbedFixer] Error in ${name} replacement:`, error);
					return acc;
				}
			}, segment);
		});

		if (this.debugMode && changed.size > 0) {
			replacements.forEach(({ name, replacement }) => {
				if (changed.has(name)) {
					if (typeof replacement === "string") {
						this.log(`replaced ${name} links ->`, replacement);
					} else {
						this.log(`replaced ${name} links`);
					}
				}
			});
		}

		return newContent;
	}

	processPaywalls(content) {
		let newContent = content;

		const paywalledDomains = [
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

		const domainPattern = paywalledDomains
			.map((d) => d.replace(/\./g, "\\."))
			.join("|");
		const paywallRegex = new RegExp(
			`(https?:\\/\\/(?:[\\w-]+\\.)?(?:${domainPattern})\\/[^\\s]+?)((?:[\\.,!\\?\\)\\]\\}>\\\"]|&amp;)+)?(?=\\s|$)`,
			"gi"
		);

		newContent = this.replaceOutsideCode(newContent, (segment) =>
			segment.replace(paywallRegex, (match, urlCore, trailing, offset, src) => {
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
					default: // archive
						wrapped = `https://archive.is/${urlCore}`;
				}
				return `${wrapped}${trailing || ""}`;
			})
		);

		if (newContent !== content) {
			this.log("processed paywalled urls (service:", this.paywallService, ")");
		}

		return newContent;
	}

	processYouTubeShorts(content) {
		const ytShortsPattern =
			/https?:\/\/(?:(?:www|m)\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{5,})(\?[^\s]*)?/gi;

		const replaceFn = (m, id, queryParams) => {
			const params = queryParams || "";
			const paramString =
				params && params.length > 1 ? "&" + params.substring(1) : "";
			return `https://youtube.com/watch?v=${id}${paramString}`;
		};

		const newContent = this.replaceOutsideCode(content, (segment) =>
			segment.replace(ytShortsPattern, replaceFn)
		);

		if (newContent !== content) {
			this.log("converted youtube shorts -> full player");
		}
		return newContent;
	}

	stop() {
		try {
			const messageModule = BdApi.Webpack.getByKeys(
				"sendMessage",
				"editMessage"
			);
			if (messageModule && this.originalSendMessage) {
				messageModule.sendMessage = this.originalSendMessage;
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
