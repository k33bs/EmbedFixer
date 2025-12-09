/**
 * EmbedFixer Unit Tests
 *
 * Run with: bun test tests/embedfixer.test.js
 * Or: node --test tests/embedfixer.test.js (Node 18+)
 *
 * These tests extract and test the transformation logic from EmbedFixer.plugin.js
 * without requiring Discord's runtime environment.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Extract the plugin class from the module.exports
let EmbedFixer;

beforeAll(() => {
	// Read the plugin file and extract the class
	const pluginPath = path.join(__dirname, "..", "EmbedFixer.plugin.js");
	const pluginCode = fs.readFileSync(pluginPath, "utf8");

	// Create a mock BdApi for testing
	const mockBdApi = {
		Data: {
			load: () => ({}),
			save: () => {},
		},
		UI: {
			showToast: () => {},
		},
		Webpack: {
			getByKeys: () => null,
		},
	};

	// Execute the plugin code in a sandboxed context
	const moduleExports = {};
	const evalCode = `
    (function(module, BdApi) {
      ${pluginCode}
      return module.exports;
    })
  `;

	try {
		EmbedFixer = eval(evalCode)({ exports: moduleExports }, mockBdApi);
	} catch (e) {
		console.error("Failed to load plugin:", e.message);
	}
});

// Helper to create plugin instance and process content
function processContent(content) {
	if (!EmbedFixer) {
		throw new Error("EmbedFixer not loaded");
	}

	const plugin = new EmbedFixer();
	plugin.debugMode = false;

	// Initialize settings
	plugin.platformToggles = {
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
		imgur: true,
		gist: true,
		pastebin: true,
		steam: true,
		youtubeShorts: true,
		trackingParams: true,
		ampLinks: true,
		amazonLinks: true,
		songLink: true,
		paywall: true,
	};
	plugin.paywallService = "archive";

	// Compile regexes
	plugin.compileRegexes();

	// Process using the same logic as the plugin
	const codeBlockRegex = plugin.codeBlockRegex;
	const tokens = content.split(codeBlockRegex);

	const processedParts = tokens.map((token, index) => {
		// Odd indices are code blocks (captured groups)
		if (index % 2 === 1) return token;

		// Process non-code content
		let processed = token;
		processed = plugin.stripTrackingParams(processed);
		processed = plugin.removeAmpLinks(processed);
		processed = plugin.cleanAmazonLinks(processed);
		processed = plugin.applyReplacements(processed);
		processed = plugin.processSongLinks(processed);
		processed = plugin.processPaywalls(processed);
		processed = plugin.processYouTubeShorts(processed);
		return processed;
	});

	return processedParts.join("");
}

// ============================================================
// TEST SUITES
// ============================================================

describe("Twitter/X", () => {
	test("converts twitter.com to fixupx.com", () => {
		expect(processContent("https://twitter.com/user/status/123")).toBe(
			"https://fixupx.com/user/status/123"
		);
	});

	test("converts x.com to fixupx.com", () => {
		expect(processContent("https://x.com/user/status/456")).toBe(
			"https://fixupx.com/user/status/456"
		);
	});

	test("converts www.twitter.com to fixupx.com", () => {
		expect(processContent("https://www.twitter.com/user/status/789")).toBe(
			"https://fixupx.com/user/status/789"
		);
	});

	test("strips tracking params from Twitter URLs", () => {
		expect(processContent("https://twitter.com/user/status/123?s=20")).toBe(
			"https://fixupx.com/user/status/123"
		);
	});

	test("does not double-fix already fixed URLs", () => {
		expect(processContent("https://fixupx.com/user/status/123")).toBe(
			"https://fixupx.com/user/status/123"
		);
	});
});

describe("Reddit", () => {
	test("converts reddit.com to rxddit.com", () => {
		expect(processContent("https://reddit.com/r/test/comments/abc")).toBe(
			"https://rxddit.com/r/test/comments/abc"
		);
	});

	test("converts www.reddit.com to rxddit.com", () => {
		expect(processContent("https://www.reddit.com/r/programming")).toBe(
			"https://rxddit.com/r/programming"
		);
	});
});

describe("TikTok", () => {
	test("converts tiktok.com to tnktok.com", () => {
		expect(processContent("https://tiktok.com/@user/video/123")).toBe(
			"https://tnktok.com/@user/video/123"
		);
	});

	test("converts www.tiktok.com to tnktok.com", () => {
		expect(processContent("https://www.tiktok.com/@user/video/456")).toBe(
			"https://tnktok.com/@user/video/456"
		);
	});

	test("converts m.tiktok.com to tnktok.com", () => {
		expect(processContent("https://m.tiktok.com/@user/video/789")).toBe(
			"https://tnktok.com/@user/video/789"
		);
	});

	test("converts vm.tiktok.com short links", () => {
		expect(processContent("https://vm.tiktok.com/abc123")).toBe(
			"https://tnktok.com/abc123"
		);
	});

	test("converts vt.tiktok.com short links", () => {
		expect(processContent("https://vt.tiktok.com/xyz789")).toBe(
			"https://tnktok.com/xyz789"
		);
	});
});

describe("Instagram", () => {
	test("converts instagram.com posts", () => {
		expect(processContent("https://instagram.com/p/ABC123")).toBe(
			"https://ddinstagram.com/p/ABC123"
		);
	});

	test("converts instagram.com reels", () => {
		expect(processContent("https://www.instagram.com/reel/XYZ789")).toBe(
			"https://ddinstagram.com/reel/XYZ789"
		);
	});
});

describe("Other Platforms", () => {
	test("converts Bluesky", () => {
		expect(
			processContent("https://bsky.app/profile/user.bsky.social/post/abc")
		).toBe("https://bsyy.app/profile/user.bsky.social/post/abc");
	});

	test("converts Threads", () => {
		expect(processContent("https://threads.net/@user/post/123")).toBe(
			"https://fixthreads.net/@user/post/123"
		);
	});

	test("converts Pixiv", () => {
		expect(processContent("https://pixiv.net/en/artworks/12345678")).toBe(
			"https://phixiv.net/en/artworks/12345678"
		);
	});

	test("converts Twitch clips", () => {
		expect(processContent("https://clips.twitch.tv/FunnyClip-abc123")).toBe(
			"https://clips.fxtwitch.tv/FunnyClip-abc123"
		);
	});

	test("converts Medium", () => {
		expect(processContent("https://medium.com/@author/article-abc123")).toBe(
			"https://scribe.rip/@author/article-abc123"
		);
	});

	test("converts Tumblr", () => {
		expect(processContent("https://tumblr.com/blog/123456")).toBe(
			"https://tpmblr.com/blog/123456"
		);
	});

	test("converts DeviantArt", () => {
		expect(processContent("https://deviantart.com/artist/art/Title-123")).toBe(
			"https://fixdeviantart.com/artist/art/Title-123"
		);
	});

	test("converts 4chan", () => {
		expect(processContent("https://boards.4chan.org/g/thread/123")).toBe(
			"https://boards.4channel.org/g/thread/123"
		);
	});
});

describe("Direct Media Links", () => {
	test("converts Giphy to direct GIF", () => {
		expect(processContent("https://giphy.com/gifs/ABC123xyz789")).toBe(
			"https://media.giphy.com/media/ABC123xyz789/giphy.gif"
		);
	});

	test("converts Giphy with slug to direct GIF", () => {
		expect(processContent("https://giphy.com/gifs/funny-cat-DEF456abc")).toBe(
			"https://media.giphy.com/media/DEF456abc/giphy.gif"
		);
	});

	test("converts Imgur to direct image", () => {
		expect(processContent("https://imgur.com/abc123X")).toBe(
			"https://i.imgur.com/abc123X.png"
		);
	});

	test("preserves Imgur extension if present", () => {
		expect(processContent("https://imgur.com/DEF456y.jpg")).toBe(
			"https://i.imgur.com/DEF456y.jpg"
		);
	});

	test("converts GitHub Gist to raw", () => {
		expect(processContent("https://gist.github.com/user/abc123def456")).toBe(
			"https://gist.githubusercontent.com/user/abc123def456/raw"
		);
	});

	test("converts Pastebin to raw", () => {
		expect(processContent("https://pastebin.com/AbC123xY")).toBe(
			"https://pastebin.com/raw/AbC123xY"
		);
	});

	test("does not double-convert Pastebin raw URLs", () => {
		expect(processContent("https://pastebin.com/raw/AlreadyRaw")).toBe(
			"https://pastebin.com/raw/AlreadyRaw"
		);
	});

	test("converts Steam store to SteamDB", () => {
		expect(processContent("https://store.steampowered.com/app/730/CS2/")).toBe(
			"https://steamdb.info/app/730/"
		);
	});
});

describe("YouTube Shorts", () => {
	test("converts Shorts to regular video", () => {
		expect(processContent("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe(
			"https://youtube.com/watch?v=dQw4w9WgXcQ"
		);
	});

	test("converts Shorts and strips tracking params", () => {
		expect(processContent("https://youtube.com/shorts/abc123?si=track")).toBe(
			"https://youtube.com/watch?v=abc123"
		);
	});
});

describe("Tracking Parameters", () => {
	test("strips UTM params", () => {
		expect(
			processContent("https://example.com/page?utm_source=twitter&real=keep")
		).toBe("https://example.com/page?real=keep");
	});

	test("strips Facebook tracking", () => {
		expect(processContent("https://example.com?fbclid=abc123")).toBe(
			"https://example.com/"
		);
	});

	test("strips Google tracking", () => {
		expect(processContent("https://example.com?gclid=xyz&page=1")).toBe(
			"https://example.com/?page=1"
		);
	});

	test("strips Instagram tracking", () => {
		expect(processContent("https://example.com?igshid=abc")).toBe(
			"https://example.com/"
		);
	});
});

describe("AMP Removal", () => {
	test("removes Google AMP cache wrapper", () => {
		expect(
			processContent("https://google.com/amp/s/example.com/article")
		).toBe("https://example.com/article");
	});

	test("removes Google AMP www wrapper", () => {
		expect(
			processContent("https://www.google.com/amp/s/news.com/story")
		).toBe("https://news.com/story");
	});

	test("removes Bing AMP wrapper", () => {
		expect(processContent("https://bing.com/amp/s/example.com/page")).toBe(
			"https://example.com/page"
		);
	});

	test("removes /amp/ from path", () => {
		expect(processContent("https://example.com/amp/article/123")).toBe(
			"https://example.com/article/123"
		);
	});
});

describe("Amazon Links", () => {
	test("keeps clean Amazon URLs unchanged", () => {
		expect(processContent("https://amazon.com/dp/B08N5WRWNW")).toBe(
			"https://amazon.com/dp/B08N5WRWNW"
		);
	});

	test("cleans long Amazon URLs to just ASIN", () => {
		expect(
			processContent(
				"https://amazon.com/Product/dp/B08N5WRWNW/ref=sr_1_1?qid=123"
			)
		).toBe("https://amazon.com/dp/B08N5WRWNW");
	});

	test("cleans Amazon UK gp/product URLs", () => {
		expect(
			processContent("https://amazon.co.uk/gp/product/B08N5WRWNW?tag=aff")
		).toBe("https://amazon.co.uk/dp/B08N5WRWNW");
	});
});

describe("Song.link Integration", () => {
	test("converts Spotify tracks", () => {
		expect(
			processContent("https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh")
		).toBe(
			"https://song.link/https%3A%2F%2Fopen.spotify.com%2Ftrack%2F4iV5W9uYEdYUVa79Axb7Rh"
		);
	});

	test("converts Apple Music", () => {
		expect(
			processContent("https://music.apple.com/us/album/name/123")
		).toBe(
			"https://song.link/https%3A%2F%2Fmusic.apple.com%2Fus%2Falbum%2Fname%2F123"
		);
	});
});

describe("Code Blocks", () => {
	test("does not modify URLs in inline code", () => {
		expect(processContent("`https://twitter.com/test`")).toBe(
			"`https://twitter.com/test`"
		);
	});

	test("does not modify URLs in code blocks", () => {
		expect(processContent("```\nhttps://twitter.com/test\n```")).toBe(
			"```\nhttps://twitter.com/test\n```"
		);
	});

	test("modifies URLs outside code but not inside", () => {
		expect(
			processContent(
				"Fix https://twitter.com/yes but `https://twitter.com/no`"
			)
		).toBe("Fix https://fixupx.com/yes but `https://twitter.com/no`");
	});
});

describe("Multiple Links", () => {
	test("handles multiple different links", () => {
		expect(
			processContent("https://twitter.com/a https://reddit.com/r/b")
		).toBe("https://fixupx.com/a https://rxddit.com/r/b");
	});
});

describe("Punctuation Handling", () => {
	test("handles trailing exclamation mark", () => {
		expect(processContent("Check https://twitter.com/test!")).toBe(
			"Check https://fixupx.com/test!"
		);
	});

	test("handles trailing period", () => {
		expect(processContent("See https://twitter.com/test.")).toBe(
			"See https://fixupx.com/test."
		);
	});

	test("handles URLs in parentheses", () => {
		expect(processContent("(https://twitter.com/test)")).toBe(
			"(https://fixupx.com/test)"
		);
	});
});

describe("Paywalls", () => {
	test("wraps NYTimes with archive.is", () => {
		expect(processContent("https://nytimes.com/2023/article")).toBe(
			"https://archive.is/https://nytimes.com/2023/article"
		);
	});

	test("wraps WSJ with archive.is", () => {
		expect(processContent("https://wsj.com/articles/story")).toBe(
			"https://archive.is/https://wsj.com/articles/story"
		);
	});

	test("wraps Bloomberg with archive.is", () => {
		expect(processContent("https://bloomberg.com/news/article")).toBe(
			"https://archive.is/https://bloomberg.com/news/article"
		);
	});
});

describe("Spoilers and Quotes", () => {
	test("transforms URLs inside spoilers", () => {
		expect(processContent("||https://twitter.com/test||")).toBe(
			"||https://fixupx.com/test||"
		);
	});

	test("transforms URLs in quotes", () => {
		expect(processContent("> https://twitter.com/test")).toBe(
			"> https://fixupx.com/test"
		);
	});
});

describe("Edge Cases", () => {
	test("handles plain text without URLs", () => {
		expect(processContent("No URLs here")).toBe("No URLs here");
	});

	test("handles empty string", () => {
		expect(processContent("")).toBe("");
	});
});
