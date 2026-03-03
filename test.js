'use strict';

/**
 * Standalone test for library.js logic.
 * Mocks NodeBB's require.main.require dependencies.
 * Run: node test.js
 */

let settingsStore = {};
let groupMembers = {};
let fetchMock = null;
let registeredRoutes = [];

// --- Mock setup ---
const originalRequire = require.main.require;
require.main.require = function (mod) {
	if (mod === './src/meta') {
		return {
			settings: {
				get: async function () {
					return settingsStore;
				},
			},
		};
	}
	if (mod === './src/groups') {
		return {
			isMember: async function (uid, group) {
				return !!(groupMembers[uid] && groupMembers[uid].includes(group));
			},
		};
	}
	if (mod === './src/routes/helpers') {
		return {
			setupApiRoute: function (router, method, path, middlewares, handler) {
				registeredRoutes.push({ method, path, middlewares, handler });
			},
		};
	}
	return originalRequire.call(require.main, mod);
};

// Mock global fetch
const originalFetch = globalThis.fetch;

function setFetchMock(fn) {
	globalThis.fetch = fn;
}

function restoreFetch() {
	globalThis.fetch = originalFetch;
}

// Load plugin after mocks
const plugin = require('./library');

// --- Test utilities ---
let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, name) {
	if (condition) {
		passed++;
		console.log(`  \x1b[32mPASS\x1b[0m ${name}`);
	} else {
		failed++;
		errors.push(name);
		console.log(`  \x1b[31mFAIL\x1b[0m ${name}`);
	}
}

function assertEqual(actual, expected, name) {
	const pass = actual === expected;
	if (!pass) {
		name += ` (got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)})`;
	}
	assert(pass, name);
}

// --- Tests ---

async function testNotSelf() {
	console.log('\n[Test] addSubscriptionData - not own profile');
	const hookData = {
		req: { uid: 1 },
		templateData: { isSelf: false, uid: 2 },
	};
	const result = await plugin.addSubscriptionData(hookData);
	assert(!result.templateData.ieuSubscription, 'should not set ieuSubscription for other user');
}

async function testNoUid() {
	console.log('\n[Test] addSubscriptionData - no uid (guest)');
	const hookData = {
		req: { uid: 0 },
		templateData: { isSelf: true, uid: 0 },
	};
	const result = await plugin.addSubscriptionData(hookData);
	assert(!result.templateData.ieuSubscription, 'should not set ieuSubscription for guest');
}

async function testNoGroupMembership() {
	console.log('\n[Test] addSubscriptionData - user not in any plan group');
	settingsStore = {};
	groupMembers = { 5: [] };
	const hookData = {
		req: { uid: 5 },
		templateData: { isSelf: true, uid: 5 },
	};
	const result = await plugin.addSubscriptionData(hookData);
	assert(!result.templateData.ieuSubscription, 'should not set ieuSubscription when not in any group');
}

async function testActiveSubscription() {
	console.log('\n[Test] addSubscriptionData - active subscription with API success');
	settingsStore = {};
	groupMembers = { 10: ['premium'] };

	const futureDate = new Date(Date.now() + 44 * 86400000).toISOString();
	setFetchMock(async () => ({
		json: async () => ({
			success: true,
			subscription: {
				plan: 'premium',
				planName: 'Premium',
				period: 'monthly',
				status: 'active',
				autoRenew: true,
				expiresAt: futureDate,
				daysRemaining: 44,
				cancelRequestedAt: null,
			},
		}),
	}));

	const hookData = {
		req: { uid: 10 },
		templateData: { isSelf: true, uid: 10 },
	};
	const result = await plugin.addSubscriptionData(hookData);
	const sub = result.templateData.ieuSubscription;

	assert(sub, 'ieuSubscription should exist');
	assertEqual(sub.active, true, 'active should be true');
	assertEqual(sub.planName, 'Premium', 'planName should be Premium');
	assertEqual(sub.period, 'monthly', 'period should be monthly');
	assertEqual(sub.periodLabel, 'Aylık', 'periodLabel should be Aylık');
	assertEqual(sub.autoRenew, true, 'autoRenew should be true');
	assertEqual(sub.daysRemaining, 44, 'daysRemaining should be 44');
	assertEqual(sub.cancelRequested, false, 'cancelRequested should be false');
	assertEqual(sub.statusFetchFailed, false, 'statusFetchFailed should be false');
	assertEqual(sub.daysWarning, false, 'daysWarning should be false (44 > 3)');
	assertEqual(sub.showCancelButton, true, 'showCancelButton should be true');
	assert(sub.expiresAtFormatted.length > 0, 'expiresAtFormatted should not be empty');

	restoreFetch();
}

async function testCancelledSubscription() {
	console.log('\n[Test] addSubscriptionData - cancelled subscription (autoRenew=false)');
	settingsStore = {};
	groupMembers = { 11: ['premium'] };

	setFetchMock(async () => ({
		json: async () => ({
			success: true,
			subscription: {
				plan: 'premium',
				planName: 'Premium',
				period: 'monthly',
				status: 'active',
				autoRenew: false,
				expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
				daysRemaining: 30,
				cancelRequestedAt: '2026-01-15T00:00:00.000Z',
			},
		}),
	}));

	const hookData = {
		req: { uid: 11 },
		templateData: { isSelf: true, uid: 11 },
	};
	const result = await plugin.addSubscriptionData(hookData);
	const sub = result.templateData.ieuSubscription;

	assertEqual(sub.autoRenew, false, 'autoRenew should be false');
	assertEqual(sub.cancelRequested, true, 'cancelRequested should be true');
	assertEqual(sub.showCancelButton, false, 'showCancelButton should be false when cancelled');

	restoreFetch();
}

async function testDaysWarning() {
	console.log('\n[Test] addSubscriptionData - days warning (<=3 days)');
	settingsStore = {};
	groupMembers = { 12: ['lite'] };

	setFetchMock(async () => ({
		json: async () => ({
			success: true,
			subscription: {
				plan: 'lite',
				planName: 'Lite',
				period: 'yearly',
				status: 'active',
				autoRenew: true,
				expiresAt: new Date(Date.now() + 2 * 86400000).toISOString(),
				daysRemaining: 2,
				cancelRequestedAt: null,
			},
		}),
	}));

	const hookData = {
		req: { uid: 12 },
		templateData: { isSelf: true, uid: 12 },
	};
	const result = await plugin.addSubscriptionData(hookData);
	const sub = result.templateData.ieuSubscription;

	assertEqual(sub.daysRemaining, 2, 'daysRemaining should be 2');
	assertEqual(sub.daysWarning, true, 'daysWarning should be true (2 <= 3)');
	assertEqual(sub.periodLabel, 'Yıllık', 'periodLabel should be Yıllık for yearly');

	restoreFetch();
}

async function testVipPriority() {
	console.log('\n[Test] addSubscriptionData - VIP priority over premium');
	settingsStore = {};
	groupMembers = { 13: ['vip', 'premium'] }; // in both groups

	setFetchMock(async () => ({
		json: async () => ({
			success: true,
			subscription: {
				plan: 'vip',
				planName: 'VIP',
				period: 'monthly',
				status: 'active',
				autoRenew: true,
				expiresAt: new Date(Date.now() + 60 * 86400000).toISOString(),
				daysRemaining: 60,
				cancelRequestedAt: null,
			},
		}),
	}));

	const hookData = {
		req: { uid: 13 },
		templateData: { isSelf: true, uid: 13 },
	};
	const result = await plugin.addSubscriptionData(hookData);
	const sub = result.templateData.ieuSubscription;

	assertEqual(sub.planName, 'VIP', 'should pick VIP (highest priority)');

	restoreFetch();
}

async function testApiFallback() {
	console.log('\n[Test] addSubscriptionData - API failure fallback');
	settingsStore = {};
	groupMembers = { 14: ['premium'] };

	setFetchMock(async () => {
		throw new Error('ECONNREFUSED');
	});

	const hookData = {
		req: { uid: 14 },
		templateData: { isSelf: true, uid: 14 },
	};
	const result = await plugin.addSubscriptionData(hookData);
	const sub = result.templateData.ieuSubscription;

	assert(sub, 'ieuSubscription should exist in fallback');
	assertEqual(sub.active, true, 'active should be true in fallback');
	assertEqual(sub.planName, 'Premium', 'planName from group in fallback');
	assertEqual(sub.statusFetchFailed, true, 'statusFetchFailed should be true');
	assertEqual(sub.showCancelButton, true, 'showCancelButton should be true in fallback');

	restoreFetch();
}

async function testApiNullSubscription() {
	console.log('\n[Test] addSubscriptionData - API returns null subscription (group sync issue)');
	settingsStore = {};
	groupMembers = { 15: ['lite'] };

	setFetchMock(async () => ({
		json: async () => ({
			success: true,
			subscription: null,
		}),
	}));

	const hookData = {
		req: { uid: 15 },
		templateData: { isSelf: true, uid: 15 },
	};
	const result = await plugin.addSubscriptionData(hookData);
	assert(!result.templateData.ieuSubscription, 'should not show card when API returns null subscription');

	restoreFetch();
}

async function testCustomGroupNames() {
	console.log('\n[Test] addSubscriptionData - custom group names from ACP');
	settingsStore = {
		liteGroupName: 'Lite',
		premiumGroupName: 'Premium',
		vipGroupName: 'VIP-Users',
	};
	groupMembers = { 16: ['VIP-Users'] };

	setFetchMock(async () => ({
		json: async () => ({
			success: true,
			subscription: {
				plan: 'vip',
				planName: 'VIP',
				period: 'monthly',
				status: 'active',
				autoRenew: true,
				expiresAt: new Date(Date.now() + 20 * 86400000).toISOString(),
				daysRemaining: 20,
				cancelRequestedAt: null,
			},
		}),
	}));

	const hookData = {
		req: { uid: 16 },
		templateData: { isSelf: true, uid: 16 },
	};
	const result = await plugin.addSubscriptionData(hookData);
	assert(result.templateData.ieuSubscription, 'should find user in custom group name');

	restoreFetch();
}

async function testRouteRegistration() {
	console.log('\n[Test] addRoutes - registers correct routes');
	registeredRoutes = [];

	const mockRouter = {};
	const mockMiddleware = { ensureLoggedIn: 'ensureLoggedIn' };
	const mockHelpers = {};

	await plugin.addRoutes({
		router: mockRouter,
		middleware: mockMiddleware,
		helpers: mockHelpers,
	});

	assertEqual(registeredRoutes.length, 2, 'should register 2 routes');
	assertEqual(registeredRoutes[0].method, 'post', 'first route should be POST');
	assertEqual(registeredRoutes[0].path, '/ieu-cancel-subscription', 'first route path');
	assertEqual(registeredRoutes[1].method, 'get', 'second route should be GET');
	assertEqual(registeredRoutes[1].path, '/ieu-subscription-status', 'second route path');
	assert(registeredRoutes[0].middlewares.includes('ensureLoggedIn'), 'POST route has ensureLoggedIn');
	assert(registeredRoutes[1].middlewares.includes('ensureLoggedIn'), 'GET route has ensureLoggedIn');
}

async function testCancelRouteSuccess() {
	console.log('\n[Test] POST /ieu-cancel-subscription - success');
	registeredRoutes = [];
	settingsStore = {};

	const futureDate = new Date(Date.now() + 30 * 86400000).toISOString();
	setFetchMock(async () => ({
		json: async () => ({
			success: true,
			message: 'Otomatik yenileme iptal edildi',
			expiresAt: futureDate,
		}),
	}));

	await plugin.addRoutes({
		router: {},
		middleware: { ensureLoggedIn: 'ensureLoggedIn' },
		helpers: {
			formatApiResponse: function (code, res, data) {
				res._code = code;
				res._data = data;
			},
		},
	});

	const cancelRoute = registeredRoutes.find(r => r.path === '/ieu-cancel-subscription');
	const res = {};
	await cancelRoute.handler({ uid: 100 }, res);

	assertEqual(res._code, 200, 'should return 200');
	assertEqual(res._data.success, true, 'response should have success:true');
	assert(res._data.daysRemaining > 0, 'should have daysRemaining > 0');

	restoreFetch();
}

async function testCancelRouteTimeout() {
	console.log('\n[Test] POST /ieu-cancel-subscription - timeout');
	registeredRoutes = [];
	settingsStore = { apiTimeout: '100' };

	setFetchMock(async () => {
		const err = new Error('aborted');
		err.name = 'AbortError';
		throw err;
	});

	await plugin.addRoutes({
		router: {},
		middleware: { ensureLoggedIn: 'ensureLoggedIn' },
		helpers: {
			formatApiResponse: function (code, res, data) {
				res._code = code;
				res._data = data;
			},
		},
	});

	const cancelRoute = registeredRoutes.find(r => r.path === '/ieu-cancel-subscription');
	const res = {};
	await cancelRoute.handler({ uid: 100 }, res);

	assertEqual(res._code, 504, 'should return 504 on timeout');

	restoreFetch();
}

async function testCancelRouteNetworkError() {
	console.log('\n[Test] POST /ieu-cancel-subscription - network error');
	registeredRoutes = [];
	settingsStore = {};

	setFetchMock(async () => {
		throw new Error('ECONNREFUSED');
	});

	await plugin.addRoutes({
		router: {},
		middleware: { ensureLoggedIn: 'ensureLoggedIn' },
		helpers: {
			formatApiResponse: function (code, res, data) {
				res._code = code;
				res._data = data;
			},
		},
	});

	const cancelRoute = registeredRoutes.find(r => r.path === '/ieu-cancel-subscription');
	const res = {};
	await cancelRoute.handler({ uid: 100 }, res);

	assertEqual(res._code, 502, 'should return 502 on network error');

	restoreFetch();
}

async function testAdminNavigation() {
	console.log('\n[Test] addAdminNavigation');
	const header = { plugins: [] };
	const result = await plugin.addAdminNavigation(header);

	assertEqual(result.plugins.length, 1, 'should add 1 plugin link');
	assertEqual(result.plugins[0].route, '/plugins/ieu-cancel-subscription', 'route should match');
	assertEqual(result.plugins[0].name, 'IEU Cancel Subscription', 'name should match');
}

// --- Run all ---
async function runAll() {
	console.log('=== nodebb-plugin-ieu-cancel-subscription tests ===');

	await testNotSelf();
	await testNoUid();
	await testNoGroupMembership();
	await testActiveSubscription();
	await testCancelledSubscription();
	await testDaysWarning();
	await testVipPriority();
	await testApiFallback();
	await testApiNullSubscription();
	await testCustomGroupNames();
	await testRouteRegistration();
	await testCancelRouteSuccess();
	await testCancelRouteTimeout();
	await testCancelRouteNetworkError();
	await testAdminNavigation();

	console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
	if (errors.length > 0) {
		console.log('\nFailed tests:');
		errors.forEach(e => console.log(`  - ${e}`));
	}
	process.exit(failed > 0 ? 1 : 0);
}

runAll().catch(err => {
	console.error('Test runner error:', err);
	process.exit(1);
});
