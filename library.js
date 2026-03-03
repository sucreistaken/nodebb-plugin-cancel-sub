'use strict';

const meta = require.main.require('./src/meta');

const plugin = {};

const PERIOD_LABELS = {
	monthly: 'Aylık',
	yearly: 'Yıllık',
};

async function getSettings() {
	const settings = await meta.settings.get('ieu-cancel-subscription');
	return {
		baseUrl: settings.subscriptionServiceUrl || 'https://forum.ieu.app/pay',
		timeout: parseInt(settings.apiTimeout, 10) || 5000,
	};
}

async function fetchFromService(path, options = {}) {
	const settings = await getSettings();
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), settings.timeout);

	const url = `${settings.baseUrl}${path}`;
	try {
		console.log('[ieu-cancel-sub] Fetching:', url);
		const response = await fetch(url, {
			signal: controller.signal,
			...options,
		});

		console.log('[ieu-cancel-sub] Response status:', response.status, '| content-type:', response.headers.get('content-type'));

		const text = await response.text();
		console.log('[ieu-cancel-sub] Body (ilk 300):', text.substring(0, 300));

		const json = JSON.parse(text);
		return json;
	} catch (err) {
		console.error('[ieu-cancel-sub] Fetch error:', url, err.message);
		throw err;
	} finally {
		clearTimeout(timer);
	}
}

function formatDateTR(isoString) {
	const date = new Date(isoString);
	return date.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function computeDaysRemaining(expiresAt) {
	const now = new Date();
	const diffMs = new Date(expiresAt).getTime() - now.getTime();
	return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function escapeHtml(str) {
	if (!str) return '';
	return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Init: Route Registration ───────────────────────────────────────
plugin.init = async function (params) {
	const { router, middleware } = params;
	console.log('[ieu-cancel-sub] init — registering routes');

	router.get('/api/ieu-subscription-status', middleware.ensureLoggedIn, async (req, res) => {
		const uid = req.uid;
		console.log('[ieu-cancel-sub] GET /api/ieu-subscription-status uid:', uid);
		try {
			const data = await fetchFromService(`/api/subscription-status?uid=${uid}`);
			return res.json({ status: { code: 'ok', message: 'OK' }, response: data });
		} catch (err) {
			return res.json({ status: { code: 'error', message: err.message }, response: {} });
		}
	});

	router.post('/api/ieu-cancel-subscription', middleware.ensureLoggedIn, async (req, res) => {
		const uid = req.uid;
		console.log('[ieu-cancel-sub] POST /api/ieu-cancel-subscription uid:', uid);
		try {
			const data = await fetchFromService('/api/cancel-subscription', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ uid }),
			});
			if (!data.success) {
				return res.json({ status: { code: 'error', message: data.error || 'Bir hata oluştu' }, response: {} });
			}
			const daysRemaining = data.expiresAt ? computeDaysRemaining(data.expiresAt) : 0;
			return res.json({
				status: { code: 'ok', message: 'OK' },
				response: {
					success: true,
					message: data.message || 'Otomatik yenileme iptal edildi',
					expiresAt: data.expiresAt || null,
					daysRemaining: daysRemaining,
				},
			});
		} catch (err) {
			return res.json({ status: { code: 'error', message: err.message }, response: {} });
		}
	});

	console.log('[ieu-cancel-sub] Routes OK');
};

// ─── Widget: Register ───────────────────────────────────────────────
plugin.defineWidgets = async function (widgets) {
	console.log('[ieu-cancel-sub] defineWidgets called');
	widgets.push({
		widget: 'ieu-cancel-subscription',
		name: 'Abonelik İptal Butonu',
		description: 'Kullanıcının abonelik durumunu ve iptal butonunu gösterir.',
		content: '',
	});
	return widgets;
};

// ─── Widget: Render ─────────────────────────────────────────────────
plugin.renderWidget = async function (widget) {
	console.log('[ieu-cancel-sub] ══ renderWidget START ══');
	console.log('[ieu-cancel-sub]   uid:', widget.uid);
	console.log('[ieu-cancel-sub]   area:', JSON.stringify(widget.area));
	console.log('[ieu-cancel-sub]   templateData.isSelf:', widget.templateData && widget.templateData.isSelf);

	// Guest — gösterme
	if (!widget.uid) {
		console.log('[ieu-cancel-sub]   SKIP: guest');
		widget.html = '';
		return widget;
	}

	// Başkasının profili — gösterme
	if (widget.templateData && widget.templateData.isSelf === false) {
		console.log('[ieu-cancel-sub]   SKIP: not own profile');
		widget.html = '';
		return widget;
	}

	// Doğrudan API'den abonelik bilgisi çek (grup kontrolü YOK)
	try {
		const data = await fetchFromService(`/api/subscription-status?uid=${widget.uid}`);
		console.log('[ieu-cancel-sub]   API data:', JSON.stringify(data));

		if (!data.active) {
			console.log('[ieu-cancel-sub]   SKIP: subscription not active');
			widget.html = '';
			return widget;
		}

		const daysRemaining = data.remainingDays != null ? data.remainingDays : computeDaysRemaining(data.expiresAt);
		const expiresFormatted = data.expiresAt ? formatDateTR(data.expiresAt) : '';
		const periodLabel = PERIOD_LABELS[data.period] || data.period || '';
		const cancelRequested = !!data.cancelRequestedAt || !data.autoRenew;
		const showCancelButton = !!data.autoRenew && !data.cancelRequestedAt;

		const html = buildCardHTML({
			planName: data.planName || data.plan || '',
			periodLabel,
			expiresFormatted,
			daysRemaining,
			daysWarning: daysRemaining <= 3,
			cancelRequested,
			showCancelButton,
			autoRenew: !!data.autoRenew,
		});

		console.log('[ieu-cancel-sub]   HTML length:', html.length);
		widget.html = html;
	} catch (err) {
		console.error('[ieu-cancel-sub]   ERROR:', err.message);
		widget.html = '';
	}

	console.log('[ieu-cancel-sub] ══ renderWidget END ══');
	return widget;
};

function buildCardHTML(data) {
	let h = '';
	h += '<div class="card mb-3" id="ieu-subscription-card"';
	h += ' data-days-remaining="' + data.daysRemaining + '"';
	h += ' data-auto-renew="' + data.autoRenew + '"';
	h += ' data-expires-formatted="' + escapeHtml(data.expiresFormatted) + '">';
	h += '<div class="card-header fw-semibold">Abonelik Durumu</div>';
	h += '<div class="card-body">';

	h += '<div class="mb-2"><span class="text-muted">Plan:</span> <strong>' + escapeHtml(data.planName) + '</strong>';
	if (data.periodLabel) {
		h += ' <span class="text-muted">(' + escapeHtml(data.periodLabel) + ')</span>';
	}
	h += '</div>';

	if (data.expiresFormatted) {
		h += '<div class="mb-2"><span class="text-muted">Bitiş Tarihi:</span> <strong>' + escapeHtml(data.expiresFormatted) + '</strong></div>';
		h += '<div class="mb-2"><span class="text-muted">Kalan Süre:</span> <strong class="text-danger">' + data.daysRemaining + ' gün</strong></div>';
	}

	if (data.daysWarning) {
		h += '<div class="alert alert-warning py-2 mb-2">Aboneliğiniz ' + data.daysRemaining + ' gün sonra sona erecek!</div>';
	}

	if (data.cancelRequested) {
		h += '<div class="alert alert-info py-2 mb-2">Otomatik yenileme iptal edildi. Aboneliğiniz ' + data.daysRemaining + ' gün sonra sona erecektir.</div>';
	}

	if (data.showCancelButton) {
		h += '<div id="ieu-cancel-action" class="mt-3">';
		h += '<button id="ieu-cancel-btn" class="btn btn-outline-danger btn-sm">Aboneliğimi İptal Et</button>';
		h += '</div>';
	}

	h += '<div id="ieu-cancel-result" class="d-none mt-3"></div>';
	h += '</div></div>';

	// İptal butonunun JavaScript'i — widget içinde, main.js'e bağımlı değil
	h += '<script>';
	h += '(function(){';
	h += 'var btn=document.getElementById("ieu-cancel-btn");';
	h += 'if(!btn)return;';
	h += 'console.log("[ieu-cancel-sub] Cancel button FOUND in widget HTML");';
	h += 'btn.addEventListener("click",function(){';
	h += 'var card=document.getElementById("ieu-subscription-card");';
	h += 'var exp=card&&card.dataset.expiresFormatted||"";';
	h += 'if(!confirm("Otomatik yenilemeyi iptal etmek istediğinizden emin misiniz?\\nAboneliğiniz mevcut dönem sonuna kadar ("+exp+") aktif kalacaktır."))return;';
	h += 'btn.disabled=true;btn.innerHTML="<span class=\\"spinner-border spinner-border-sm\\"></span> İşleniyor...";';
	h += 'fetch(config.relative_path+"/api/ieu-cancel-subscription",{method:"POST",headers:{"Content-Type":"application/json","x-csrf-token":config.csrf_token}})';
	h += '.then(function(r){return r.json()})';
	h += '.then(function(d){';
	h += 'console.log("[ieu-cancel-sub] Cancel response:",JSON.stringify(d));';
	h += 'if(d.status&&d.status.code==="ok"){';
	h += 'var a=document.getElementById("ieu-cancel-action");if(a)a.classList.add("d-none");';
	h += 'var r=document.getElementById("ieu-cancel-result");';
	h += 'if(r){r.classList.remove("d-none");r.innerHTML="<div class=\\"alert alert-success py-2\\">\\u2713 Otomatik yenileme iptal edildi. Aboneliğiniz "+d.response.daysRemaining+" gün sonra sona erecektir.</div>";}';
	h += '}else{alert((d.status&&d.status.message)||"Bir hata oluştu");btn.disabled=false;btn.textContent="Aboneliğimi İptal Et";}';
	h += '}).catch(function(){alert("Bağlantı hatası.");btn.disabled=false;btn.textContent="Aboneliğimi İptal Et";});';
	h += '},{once:true});';
	h += '})();';
	h += '</script>';

	return h;
}

// ─── Admin Navigation ───────────────────────────────────────────────
plugin.addAdminNavigation = async (header) => {
	header.plugins.push({
		route: '/plugins/ieu-cancel-subscription',
		icon: 'fa-credit-card',
		name: 'IEU Cancel Subscription',
	});
	return header;
};

module.exports = plugin;
