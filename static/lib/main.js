'use strict';

console.log('[ieu-cancel-sub] main.js loaded');

$(window).on('action:ajaxify.end', function () {
	var url = ajaxify.data && ajaxify.data.url;
	if (!url || !url.startsWith('/user/')) return;
	if (!config.loggedIn || !config.uid) return;
	if (!ajaxify.data.isSelf) return;

	// Zaten eklenmişse tekrar ekleme
	if (document.getElementById('ieu-subscription-card')) return;

	console.log('[ieu-cancel-sub] Profil sayfası, abonelik durumu sorgulanıyor...');

	$.ajax({
		url: config.relative_path + '/api/ieu-subscription-status',
		method: 'GET',
		headers: { 'x-csrf-token': config.csrf_token },
	}).done(function (result) {
		console.log('[ieu-cancel-sub] API yanıtı:', JSON.stringify(result));

		if (!result || result.status.code !== 'ok') {
			console.log('[ieu-cancel-sub] API hatası, kart gösterilmiyor');
			return;
		}

		var data = result.response;
		if (!data || !data.active) {
			console.log('[ieu-cancel-sub] Aktif abonelik yok');
			return;
		}

		var html = buildCardHTML(data);
		injectCard(html);
		bindCancelButton(data);
	}).fail(function (err) {
		console.error('[ieu-cancel-sub] API isteği başarısız:', err.statusText);
	});
});

function buildCardHTML(data) {
	var periodLabels = { monthly: 'Aylık', yearly: 'Yıllık' };
	var periodLabel = periodLabels[data.period] || data.period || '';
	var planName = data.planName || data.plan || '';
	var daysRemaining = data.remainingDays != null ? data.remainingDays : computeDaysRemaining(data.expiresAt);
	var expiresFormatted = data.expiresAt ? formatDateTR(data.expiresAt) : '';
	var cancelRequested = !!data.cancelRequestedAt || !data.autoRenew;
	var showCancelButton = !!data.autoRenew && !data.cancelRequestedAt;

	var h = '';
	h += '<div class="card mb-3" id="ieu-subscription-card"';
	h += ' data-days-remaining="' + daysRemaining + '"';
	h += ' data-auto-renew="' + !!data.autoRenew + '"';
	h += ' data-expires-formatted="' + escapeHtml(expiresFormatted) + '">';
	h += '<div class="card-header fw-semibold">Abonelik Durumu</div>';
	h += '<div class="card-body">';

	h += '<div class="mb-2"><span class="text-muted">Plan:</span> <strong>' + escapeHtml(planName) + '</strong>';
	if (periodLabel) {
		h += ' <span class="text-muted">(' + escapeHtml(periodLabel) + ')</span>';
	}
	h += '</div>';

	if (expiresFormatted) {
		h += '<div class="mb-2"><span class="text-muted">Bitiş Tarihi:</span> <strong>' + escapeHtml(expiresFormatted) + '</strong></div>';
		h += '<div class="mb-2"><span class="text-muted">Kalan Süre:</span> <strong id="ieu-days-value" class="' + (daysRemaining <= 3 ? 'text-danger' : '') + '">' + daysRemaining + ' gün</strong></div>';
	}

	if (daysRemaining <= 3) {
		h += '<div class="alert alert-warning py-2 mb-2">Aboneliğiniz ' + daysRemaining + ' gün sonra sona erecek!</div>';
	}

	if (cancelRequested) {
		h += '<div class="alert alert-info py-2 mb-2">Otomatik yenileme iptal edildi. Aboneliğiniz ' + daysRemaining + ' gün sonra sona erecektir.</div>';
	}

	if (showCancelButton) {
		h += '<div id="ieu-cancel-action" class="mt-3">';
		h += '<button id="ieu-cancel-btn" class="btn btn-outline-danger btn-sm">Aboneliğimi İptal Et</button>';
		h += '</div>';
	}

	h += '<div id="ieu-cancel-result" class="d-none mt-3"></div>';
	h += '</div></div>';

	return h;
}

function injectCard(html) {
	// Öncelik sırası: profile-aboutme-before widget alanı, yoksa profil içeriğinin başına ekle
	var target = document.querySelector('[data-widget-area="profile-aboutme-before"]');
	if (target) {
		$(target).prepend(html);
		console.log('[ieu-cancel-sub] Kart profile-aboutme-before alanına eklendi');
		return;
	}

	// Alternatif: sidebar widget alanı
	target = document.querySelector('[data-widget-area="sidebar-footer"]');
	if (target) {
		$(target).prepend(html);
		console.log('[ieu-cancel-sub] Kart sidebar-footer alanına eklendi');
		return;
	}

	// Son çare: profil sayfasının ana içerik alanı
	target = document.querySelector('[component="account/profile"]') ||
		document.querySelector('.profile-content') ||
		document.querySelector('#content .col-12');
	if (target) {
		$(target).prepend(html);
		console.log('[ieu-cancel-sub] Kart profil içerik alanına eklendi');
		return;
	}

	// En son çare: #content'e ekle
	$('#content').prepend(html);
	console.log('[ieu-cancel-sub] Kart #content alanına eklendi');
}

function bindCancelButton(data) {
	var btn = document.getElementById('ieu-cancel-btn');
	if (!btn) return;

	console.log('[ieu-cancel-sub] İptal butonu bulundu, handler bağlanıyor');

	$(btn).on('click', function () {
		var card = document.getElementById('ieu-subscription-card');
		var exp = card && card.dataset.expiresFormatted || '';

		showConfirmModal(
			'Abonelik İptali',
			'Otomatik yenilemeyi iptal etmek istediğinizden emin misiniz?<br><small class="text-muted">Aboneliğiniz mevcut dönem sonuna kadar (' + escapeHtml(exp) + ') aktif kalacaktır.</small>',
			function () {
				btn.disabled = true;
				btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> İşleniyor...';

				$.ajax({
					url: config.relative_path + '/api/ieu-cancel-subscription',
					method: 'POST',
					contentType: 'application/json',
					headers: { 'x-csrf-token': config.csrf_token },
				}).done(function (d) {
					console.log('[ieu-cancel-sub] İptal yanıtı:', JSON.stringify(d));
					if (d.status && d.status.code === 'ok') {
						var action = document.getElementById('ieu-cancel-action');
						if (action) action.classList.add('d-none');

						var result = document.getElementById('ieu-cancel-result');
						if (result) {
							result.classList.remove('d-none');
							result.innerHTML = '<div class="alert alert-success py-2">\u2713 Otomatik yenileme iptal edildi. Aboneliğiniz ' + d.response.daysRemaining + ' gün sonra sona erecektir.</div>';
						}
					} else {
						showAlertModal('Hata', (d.status && d.status.message) || 'Bir hata oluştu', 'danger');
						btn.disabled = false;
						btn.textContent = 'Aboneliğimi İptal Et';
					}
				}).fail(function () {
					showAlertModal('Bağlantı Hatası', 'Sunucuya bağlanılamadı. Lütfen tekrar deneyin.', 'danger');
					btn.disabled = false;
					btn.textContent = 'Aboneliğimi İptal Et';
				});
			}
		);
	});
}

// ─── Modal Helpers ───────────────────────────────────────────────────

function showConfirmModal(title, message, onConfirm) {
	// Eski modal varsa kaldır
	$('#ieu-modal').remove();

	var modal = '';
	modal += '<div class="modal fade" id="ieu-modal" tabindex="-1">';
	modal += '<div class="modal-dialog modal-dialog-centered">';
	modal += '<div class="modal-content">';
	modal += '<div class="modal-header">';
	modal += '<h5 class="modal-title">' + title + '</h5>';
	modal += '<button type="button" class="btn-close" data-bs-dismiss="modal"></button>';
	modal += '</div>';
	modal += '<div class="modal-body"><p>' + message + '</p></div>';
	modal += '<div class="modal-footer">';
	modal += '<button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Vazgeç</button>';
	modal += '<button type="button" class="btn btn-danger btn-sm" id="ieu-modal-confirm">Evet, İptal Et</button>';
	modal += '</div>';
	modal += '</div></div></div>';

	$('body').append(modal);
	var $modal = $('#ieu-modal');
	var bsModal = new bootstrap.Modal($modal[0]);

	$('#ieu-modal-confirm').one('click', function () {
		bsModal.hide();
		onConfirm();
	});

	$modal.on('hidden.bs.modal', function () {
		$modal.remove();
	});

	bsModal.show();
}

function showAlertModal(title, message, type) {
	$('#ieu-modal').remove();

	var iconMap = {
		danger: '<i class="fa fa-exclamation-circle text-danger me-2"></i>',
		success: '<i class="fa fa-check-circle text-success me-2"></i>',
		warning: '<i class="fa fa-exclamation-triangle text-warning me-2"></i>',
	};
	var icon = iconMap[type] || '';

	var modal = '';
	modal += '<div class="modal fade" id="ieu-modal" tabindex="-1">';
	modal += '<div class="modal-dialog modal-dialog-centered modal-sm">';
	modal += '<div class="modal-content">';
	modal += '<div class="modal-header">';
	modal += '<h5 class="modal-title">' + icon + title + '</h5>';
	modal += '<button type="button" class="btn-close" data-bs-dismiss="modal"></button>';
	modal += '</div>';
	modal += '<div class="modal-body"><p>' + message + '</p></div>';
	modal += '<div class="modal-footer">';
	modal += '<button type="button" class="btn btn-primary btn-sm" data-bs-dismiss="modal">Tamam</button>';
	modal += '</div>';
	modal += '</div></div></div>';

	$('body').append(modal);
	var $modal = $('#ieu-modal');
	var bsModal = new bootstrap.Modal($modal[0]);

	$modal.on('hidden.bs.modal', function () {
		$modal.remove();
	});

	bsModal.show();
}

function formatDateTR(isoString) {
	var date = new Date(isoString);
	return date.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function computeDaysRemaining(expiresAt) {
	var now = new Date();
	var diffMs = new Date(expiresAt).getTime() - now.getTime();
	return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function escapeHtml(str) {
	if (!str) return '';
	return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
