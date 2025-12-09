/**
 * EmbedFixer Discord Console Integration Test
 *
 * This script tests the plugin in Discord's actual runtime environment.
 * It sends real messages and verifies the plugin transforms them correctly.
 *
 * Usage:
 * 1. Open Discord Developer Console (Cmd+Option+I on Mac, Ctrl+Shift+I on Windows)
 * 2. Copy and paste this entire script
 * 3. Run: eft.start() to run all tests in current channel
 *    Or:  eft.start("CHANNEL_ID") to run in specific channel
 *    Or:  eft.send("https://twitter.com/test") to test single URL
 *    Or:  eft.debug() to inspect MessageStore structure
 *    Or:  eft.help() for all commands
 *
 * WARNING: This sends real messages! Use a private test channel.
 */

(() => {
	// Get Discord modules
	const MessageActions = BdApi.Webpack.getByKeys("sendMessage", "editMessage");
	const MessageStore = BdApi.Webpack.getByKeys("getMessage", "hasCurrentUserSentMessage");
	const SelectedChannelStore = BdApi.Webpack.getByKeys("getChannelId", "getVoiceChannelId");
	const ChannelStore = BdApi.Webpack.getByKeys("getChannel", "getDMFromUserId");

	// Current target channel (set via start() or setChannel())
	let targetChannelId = null;

	// Helper to create a proper message object with nonce
	const createMessagePayload = (content) => {
		return {
			content: content,
			invalidEmojis: [],
			tts: false,
			validNonShortcutEmojis: []
		};
	};

	// Wrapper for sendMessage that handles Discord's internal requirements
	// Discord expects: sendMessage(channelId, payload, undefined, {})
	// - 3rd arg is for file uploads/promises
	// - 4th arg is options object (Discord reads nonce from here)
	const sendMessage = async (content) => {
		if (!targetChannelId) throw new Error("No channel set. Use eft.start() or eft.setChannel()");
		const payload = createMessagePayload(content);
		return await MessageActions.sendMessage(targetChannelId, payload, undefined, {});
	};

	// Helper function to get messages from the store
	const getRecentMessage = () => {
		if (!MessageStore || !targetChannelId) return null;

		const messages = MessageStore.getMessages(targetChannelId);
		if (!messages) return null;

		// Discord's message collection has various structures depending on version
		// Try common patterns

		// Pattern 1: _array property
		if (messages._array && messages._array.length > 0) {
			return messages._array[messages._array.length - 1];
		}

		// Pattern 2: toArray method
		if (typeof messages.toArray === "function") {
			const arr = messages.toArray();
			if (arr.length > 0) return arr[arr.length - 1];
		}

		// Pattern 3: last() method
		if (typeof messages.last === "function") {
			return messages.last();
		}

		// Pattern 4: It's already an array
		if (Array.isArray(messages) && messages.length > 0) {
			return messages[messages.length - 1];
		}

		// Pattern 5: Check for common cache key patterns
		if (messages.cache) {
			const cache = messages.cache;
			if (cache._array) return cache._array[cache._array.length - 1];
			if (typeof cache.last === "function") return cache.last();
		}

		// Pattern 6: Iterable
		try {
			const arr = [...messages];
			if (arr.length > 0) return arr[arr.length - 1];
		} catch (e) {}

		return null;
	};

	// Helper to send and verify
	const sendAndVerify = async (input, expectedOrFn, testName) => {
		try {
			// Resolve expected value (can be string or function returning string)
			const expected = typeof expectedOrFn === "function" ? expectedOrFn() : expectedOrFn;

			// Send the message - the plugin modifies content BEFORE sending
			await sendMessage(input);

			// Wait for message to appear in store
			await new Promise((r) => setTimeout(r, 800));

			// Get the most recent message in the channel
			const recent = getRecentMessage();
			const actual = recent?.content ?? "[FAILED TO FETCH]";

			// Compare
			const passed = actual === expected;
			const status = passed ? "✅ PASS" : "❌ FAIL";

			console.log(`${status} | ${testName}`);
			if (!passed) {
				console.log(`   Input:    ${input}`);
				console.log(`   Expected: ${expected}`);
				console.log(`   Actual:   ${actual}`);
			}

			return { passed, testName, input, expected, actual };
		} catch (err) {
			console.log(`💥 ERROR | ${testName}: ${err.message}`);
			return {
				passed: false,
				testName,
				input,
				expected,
				actual: err.message,
				error: true,
			};
		}
	};

	// Helper to generate expected paywall URL based on user's setting
	const getPaywallUrl = (url) => {
		const service = BdApi.Data.load("EmbedFixer", "paywallService") ?? "archive";
		switch (service) {
			case "removepaywall":
				return `https://www.removepaywall.com/search?url=${encodeURIComponent(url)}`;
			case "12ft":
				return `https://12ft.io/${url}`;
			default:
				return `https://archive.is/${url}`;
		}
	};

	// Test cases: [input, expected, name]
	const tests = [
		// ========================================
		// TWITTER / X
		// ========================================
		[
			"https://twitter.com/user/status/123",
			"https://fixupx.com/user/status/123",
			"Twitter basic",
		],
		[
			"https://x.com/user/status/456",
			"https://fixupx.com/user/status/456",
			"X.com basic",
		],
		[
			"https://www.twitter.com/user/status/789",
			"https://fixupx.com/user/status/789",
			"Twitter www",
		],
		[
			"https://twitter.com/user/status/123?s=20",
			"https://fixupx.com/user/status/123",
			"Twitter + tracking",
		],

		// ========================================
		// REDDIT
		// ========================================
		[
			"https://reddit.com/r/test/comments/abc",
			"https://rxddit.com/r/test/comments/abc",
			"Reddit basic",
		],
		[
			"https://www.reddit.com/r/programming",
			"https://rxddit.com/r/programming",
			"Reddit www",
		],

		// ========================================
		// TIKTOK
		// ========================================
		[
			"https://tiktok.com/@user/video/123",
			"https://tnktok.com/@user/video/123",
			"TikTok basic",
		],
		[
			"https://www.tiktok.com/@user/video/456",
			"https://tnktok.com/@user/video/456",
			"TikTok www",
		],
		[
			"https://m.tiktok.com/@user/video/789",
			"https://tnktok.com/@user/video/789",
			"TikTok mobile",
		],
		["https://vm.tiktok.com/abc123", "https://tnktok.com/abc123", "TikTok vm"],
		["https://vt.tiktok.com/xyz789", "https://tnktok.com/xyz789", "TikTok vt"],

		// ========================================
		// INSTAGRAM
		// ========================================
		[
			"https://instagram.com/p/ABC123",
			"https://ddinstagram.com/p/ABC123",
			"Instagram post",
		],
		[
			"https://www.instagram.com/reel/XYZ789",
			"https://ddinstagram.com/reel/XYZ789",
			"Instagram reel",
		],

		// ========================================
		// BLUESKY
		// ========================================
		[
			"https://bsky.app/profile/user.bsky.social/post/abc",
			"https://bsyy.app/profile/user.bsky.social/post/abc",
			"Bluesky",
		],

		// ========================================
		// THREADS
		// ========================================
		[
			"https://threads.net/@user/post/123",
			"https://fixthreads.net/@user/post/123",
			"Threads",
		],

		// ========================================
		// PIXIV
		// ========================================
		[
			"https://pixiv.net/en/artworks/12345678",
			"https://phixiv.net/en/artworks/12345678",
			"Pixiv",
		],

		// ========================================
		// TWITCH CLIPS
		// ========================================
		[
			"https://clips.twitch.tv/FunnyClip-abc123",
			"https://clips.fxtwitch.tv/FunnyClip-abc123",
			"Twitch clip",
		],

		// ========================================
		// MEDIUM
		// ========================================
		[
			"https://medium.com/@author/article-abc123",
			"https://scribe.rip/@author/article-abc123",
			"Medium",
		],

		// ========================================
		// TUMBLR
		// ========================================
		[
			"https://tumblr.com/blog/123456",
			"https://tpmblr.com/blog/123456",
			"Tumblr",
		],

		// ========================================
		// DEVIANTART
		// ========================================
		[
			"https://deviantart.com/artist/art/Title-123",
			"https://fixdeviantart.com/artist/art/Title-123",
			"DeviantArt",
		],

		// ========================================
		// 4CHAN
		// ========================================
		[
			"https://boards.4chan.org/g/thread/123",
			"https://boards.4channel.org/g/thread/123",
			"4chan",
		],

		// ========================================
		// GIPHY
		// ========================================
		[
			"https://giphy.com/gifs/ABC123xyz789",
			"https://media.giphy.com/media/ABC123xyz789/giphy.gif",
			"Giphy basic",
		],
		[
			"https://giphy.com/gifs/funny-cat-DEF456abc",
			"https://media.giphy.com/media/DEF456abc/giphy.gif",
			"Giphy with slug",
		],

		// ========================================
		// IMGUR
		// ========================================
		[
			"https://imgur.com/abc123X",
			"https://i.imgur.com/abc123X.png",
			"Imgur basic",
		],
		[
			"https://imgur.com/DEF456y.jpg",
			"https://i.imgur.com/DEF456y.jpg",
			"Imgur with ext",
		],

		// ========================================
		// GITHUB GIST
		// ========================================
		[
			"https://gist.github.com/user/abc123def456",
			"https://gist.githubusercontent.com/user/abc123def456/raw",
			"Gist",
		],

		// ========================================
		// PASTEBIN
		// ========================================
		[
			"https://pastebin.com/AbC123xY",
			"https://pastebin.com/raw/AbC123xY",
			"Pastebin",
		],
		[
			"https://pastebin.com/raw/AlreadyRaw",
			"https://pastebin.com/raw/AlreadyRaw",
			"Pastebin already raw",
		],

		// ========================================
		// STEAM
		// ========================================
		[
			"https://store.steampowered.com/app/730/CS2/",
			"https://steamdb.info/app/730/",
			"Steam",
		],

		// ========================================
		// YOUTUBE SHORTS
		// ========================================
		[
			"https://youtube.com/shorts/dQw4w9WgXcQ",
			"https://youtube.com/watch?v=dQw4w9WgXcQ",
			"YT Shorts basic",
		],
		[
			"https://youtube.com/shorts/abc123?si=track",
			"https://youtube.com/watch?v=abc123",
			"YT Shorts + tracking",
		],

		// ========================================
		// TRACKING PARAMS
		// ========================================
		[
			"https://example.com/page?utm_source=twitter&real=keep",
			"https://example.com/page?real=keep",
			"UTM strip",
		],
		[
			"https://example.com?fbclid=abc123",
			"https://example.com/",
			"Facebook tracking",
		],
		[
			"https://example.com?gclid=xyz&page=1",
			"https://example.com/?page=1",
			"Google tracking",
		],
		[
			"https://example.com?igshid=abc",
			"https://example.com/",
			"Instagram tracking",
		],

		// ========================================
		// AMP REMOVAL
		// ========================================
		[
			"https://google.com/amp/s/example.com/article",
			"https://example.com/article",
			"Google AMP cache",
		],
		[
			"https://www.google.com/amp/s/news.com/story",
			"https://news.com/story",
			"Google AMP www",
		],
		[
			"https://bing.com/amp/s/example.com/page",
			"https://example.com/page",
			"Bing AMP",
		],
		[
			"https://example.com/amp/article/123",
			"https://example.com/article/123",
			"AMP in path",
		],

		// ========================================
		// AMAZON
		// ========================================
		[
			"https://amazon.com/dp/B08N5WRWNW",
			"https://amazon.com/dp/B08N5WRWNW",
			"Amazon clean",
		],
		[
			"https://amazon.com/Product/dp/B08N5WRWNW/ref=sr_1_1?qid=123",
			"https://amazon.com/dp/B08N5WRWNW",
			"Amazon long URL",
		],
		[
			"https://amazon.co.uk/gp/product/B08N5WRWNW?tag=aff",
			"https://amazon.co.uk/dp/B08N5WRWNW",
			"Amazon UK gp/product",
		],

		// ========================================
		// SONG.LINK
		// ========================================
		[
			"https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh",
			"https://song.link/https%3A%2F%2Fopen.spotify.com%2Ftrack%2F4iV5W9uYEdYUVa79Axb7Rh",
			"Spotify track",
		],
		[
			"https://music.apple.com/us/album/name/123",
			"https://song.link/https%3A%2F%2Fmusic.apple.com%2Fus%2Falbum%2Fname%2F123",
			"Apple Music",
		],

		// ========================================
		// CODE BLOCKS (should NOT change)
		// ========================================
		[
			"`https://twitter.com/test`",
			"`https://twitter.com/test`",
			"Inline code unchanged",
		],
		[
			"```\nhttps://twitter.com/test\n```",
			"```\nhttps://twitter.com/test\n```",
			"Code block unchanged",
		],
		[
			"Fix https://twitter.com/yes but `https://twitter.com/no`",
			"Fix https://fixupx.com/yes but `https://twitter.com/no`",
			"Mixed code/normal",
		],

		// ========================================
		// MULTIPLE LINKS
		// ========================================
		[
			"https://twitter.com/a https://reddit.com/r/b",
			"https://fixupx.com/a https://rxddit.com/r/b",
			"Multiple links",
		],

		// ========================================
		// PUNCTUATION
		// ========================================
		[
			"Check https://twitter.com/test!",
			"Check https://fixupx.com/test!",
			"Trailing !",
		],
		[
			"See https://twitter.com/test.",
			"See https://fixupx.com/test.",
			"Trailing .",
		],
		[
			"(https://twitter.com/test)",
			"(https://fixupx.com/test)",
			"In parentheses",
		],

		// ========================================
		// ALREADY FIXED (should not double-fix)
		// ========================================
		[
			"https://fixupx.com/user/status/123",
			"https://fixupx.com/user/status/123",
			"Already fixed Twitter",
		],
		[
			"https://rxddit.com/r/test",
			"https://rxddit.com/r/test",
			"Already fixed Reddit",
		],

		// ========================================
		// PAYWALLS (expected URLs generated dynamically based on user setting)
		// ========================================
		[
			"https://nytimes.com/2023/article",
			() => getPaywallUrl("https://nytimes.com/2023/article"),
			"NYTimes paywall",
		],
		[
			"https://wsj.com/articles/story",
			() => getPaywallUrl("https://wsj.com/articles/story"),
			"WSJ paywall",
		],

		// ========================================
		// SPOILERS & QUOTES
		// ========================================
		[
			"||https://twitter.com/test||",
			"||https://fixupx.com/test||",
			"URL in spoiler",
		],
		[
			"> https://twitter.com/test",
			"> https://fixupx.com/test",
			"URL in quote",
		],

		// ========================================
		// EDGE CASES
		// ========================================
		["No URLs here", "No URLs here", "Plain text"],
		// Note: Empty string test removed - Discord doesn't send empty messages
	];

	// ============================================================
	// TEST RUNNER
	// ============================================================

	let results = [];
	let currentIndex = 0;
	let isRunning = false;
	let delay = 1200; // Time between tests for verification

	const runNext = async () => {
		if (!isRunning || currentIndex >= tests.length) {
			if (currentIndex >= tests.length) {
				printSummary();
			}
			isRunning = false;
			return;
		}

		const [input, expected, name] = tests[currentIndex];
		const result = await sendAndVerify(input, expected, name);
		results.push(result);
		currentIndex++;

		setTimeout(runNext, delay);
	};

	const printSummary = () => {
		const passed = results.filter((r) => r.passed).length;
		const failed = results.filter((r) => !r.passed).length;

		console.log(`\n${"=".repeat(60)}`);
		console.log(`TEST SUMMARY`);
		console.log(`${"=".repeat(60)}`);
		console.log(`✅ Passed: ${passed}`);
		console.log(`❌ Failed: ${failed}`);
		console.log(`📊 Total:  ${results.length}`);
		console.log(`${"=".repeat(60)}`);

		if (failed > 0) {
			console.log(`\nFailed tests:`);
			results
				.filter((r) => !r.passed)
				.forEach((r) => {
					console.log(`\n  ❌ ${r.testName}`);
					console.log(`     Input:    ${r.input}`);
					console.log(`     Expected: ${r.expected}`);
					console.log(`     Actual:   ${r.actual}`);
				});
		}
	};

	// Helper to get channel info
	const getChannelInfo = (channelId) => {
		if (!ChannelStore || !channelId) return null;
		return ChannelStore.getChannel(channelId);
	};

	// Control functions
	window.EmbedFixerTests = {
		// Set the target channel
		setChannel: (channelId) => {
			if (!channelId) {
				// Use current channel
				targetChannelId = SelectedChannelStore?.getChannelId();
			} else {
				targetChannelId = channelId;
			}

			const channel = getChannelInfo(targetChannelId);
			const channelName = channel?.name || "Unknown/DM";
			console.log(`📍 Target channel set: ${channelName} (${targetChannelId})`);
			return targetChannelId;
		},

		// Debug helper to see MessageStore structure
		debug: () => {
			const currentChannelId = SelectedChannelStore?.getChannelId();

			console.log("=== DEBUG INFO ===");
			console.log("Target channel:", targetChannelId);
			console.log("Current channel:", currentChannelId);
			console.log("MessageStore:", MessageStore);

			if (MessageStore && targetChannelId) {
				const messages = MessageStore.getMessages(targetChannelId);
				console.log("\n--- getMessages result ---");
				console.log("messages:", messages);

				if (messages?._array?.length > 0) {
					const last = messages._array[messages._array.length - 1];
					console.log("Last message content:", last?.content);
				}
			}

			console.log("\n--- getRecentMessage() ---");
			console.log("Result:", getRecentMessage());
		},

		start: (channelId) => {
			// Set channel (use provided, or current channel)
			if (channelId) {
				targetChannelId = channelId;
			} else {
				targetChannelId = SelectedChannelStore?.getChannelId();
			}

			if (!targetChannelId) {
				console.error("❌ No channel available. Navigate to a channel first or provide a channel ID.");
				return;
			}

			const channel = getChannelInfo(targetChannelId);
			const channelName = channel?.name || "DM/Unknown";
			const guildName = channel?.guild?.name || "DM";

			// Warning for potentially public channels
			console.log(`\n⚠️  WARNING: This will send ${tests.length} real messages!`);
			console.log(`📍 Target: #${channelName} in ${guildName}`);
			console.log(`🆔 Channel ID: ${targetChannelId}`);
			console.log(`\n   Make sure this is a private test channel!`);
			console.log(`   Press Ctrl+C to cancel, or wait 6 seconds to continue...\n`);

			// 6 second delay before starting
			setTimeout(() => {
				results = [];
				currentIndex = 0;
				isRunning = true;
				console.log(`\n🚀 Starting ${tests.length} tests...`);
				console.log(`⏱️  Delay: ${delay}ms between messages`);
				console.log(`🛑 Use eft.stop() to stop\n`);
				runNext();
			}, 6000);
		},

		stop: () => {
			isRunning = false;
			console.log(`\n⏹️  Stopped at test ${currentIndex}/${tests.length}`);
			printSummary();
		},

		resume: () => {
			if (currentIndex < tests.length) {
				isRunning = true;
				console.log(`\n▶️  Resuming from test ${currentIndex}/${tests.length}`);
				runNext();
			} else {
				console.log("All tests completed!");
				printSummary();
			}
		},

		setDelay: (ms) => {
			delay = ms;
			console.log(`⏱️  Delay set to ${ms}ms`);
		},

		single: async (input, expected, name = "Single test") => {
			const result = await sendAndVerify(input, expected, name);
			return result;
		},

		send: async (input) => {
			// Auto-set channel to current if not set
			if (!targetChannelId) {
				targetChannelId = SelectedChannelStore?.getChannelId();
			}
			if (!targetChannelId) {
				console.error("❌ No channel set. Navigate to a channel first.");
				return;
			}

			await sendMessage(input);
			await new Promise((r) => setTimeout(r, 800));
			const recent = getRecentMessage();
			console.log(`Input:  ${input}`);
			console.log(`Output: ${recent?.content || "[FAILED]"}`);
			return recent?.content;
		},

		results: () => {
			printSummary();
			return results;
		},

		failed: () => {
			return results.filter((r) => !r.passed);
		},

		status: () => {
			console.log(`\n📊 Status: ${currentIndex}/${tests.length} tests`);
			console.log(`   Running: ${isRunning}`);
			console.log(`   Passed: ${results.filter((r) => r.passed).length}`);
			console.log(`   Failed: ${results.filter((r) => !r.passed).length}`);
		},

		help: () => {
			console.log(`
╔═══════════════════════════════════════════════════════════╗
║       EmbedFixer Test Suite                               ║
╠═══════════════════════════════════════════════════════════╣
║  eft.start()              - Run tests in current channel  ║
║  eft.start("CHANNEL_ID")  - Run tests in specific channel ║
║  eft.setChannel("ID")     - Set target channel            ║
║  eft.stop()               - Stop and show results         ║
║  eft.resume()             - Resume from current           ║
║  eft.setDelay(ms)         - Set delay (default 1200)      ║
║  eft.send(url)            - Send & show result            ║
║  eft.single(in, out, name)- Test single case              ║
║  eft.results()            - Show full results             ║
║  eft.failed()             - Get failed tests              ║
║  eft.status()             - Show status                   ║
║  eft.debug()              - Debug MessageStore            ║
║  eft.help()               - Show this help                ║
╚═══════════════════════════════════════════════════════════╝
            `);
		},
	};

	window.eft = window.EmbedFixerTests;

	const currentChannel = SelectedChannelStore?.getChannelId();
	const channelInfo = currentChannel ? getChannelInfo(currentChannel) : null;
	const channelName = channelInfo?.name || "none";

	console.log(`
╔═══════════════════════════════════════════════════════════╗
║     EmbedFixer Test Suite Loaded!                         ║
║     ${tests.length} test cases ready                                 ║
╠═══════════════════════════════════════════════════════════╣
║  Current channel: #${channelName.padEnd(37)}║
║                                                           ║
║  ⚠️  WARNING: Tests send real messages!                   ║
║  Use a private test channel.                              ║
║                                                           ║
║  Quick start:                                             ║
║    eft.start()     - Run all tests in current channel     ║
║    eft.send(url)   - Test single URL                      ║
║    eft.help()      - Show all commands                    ║
╚═══════════════════════════════════════════════════════════╝
    `);
})();
