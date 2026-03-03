<!-- IF isSelf -->
<!-- IF ieuSubscription.active -->
<div class="card mb-3" id="ieu-subscription-card"
     data-days-remaining="{ieuSubscription.daysRemaining}"
     data-auto-renew="{ieuSubscription.autoRenew}"
     data-expires-formatted="{ieuSubscription.expiresAtFormatted}">
  <div class="card-header fw-semibold">
    Abonelik Durumu
  </div>
  <div class="card-body">

    <!-- Plan ve Periyot -->
    <div class="mb-2">
      <span class="text-muted">Plan:</span>
      <strong>{ieuSubscription.planName}</strong>
      <!-- IF !ieuSubscription.statusFetchFailed -->
      <span class="text-muted">({ieuSubscription.periodLabel})</span>
      <!-- ENDIF !ieuSubscription.statusFetchFailed -->
    </div>

    <!-- Detaylı bilgi — sadece API başarılıysa -->
    <!-- IF !ieuSubscription.statusFetchFailed -->

    <div class="mb-2">
      <span class="text-muted">Bitiş Tarihi:</span>
      <strong>{ieuSubscription.expiresAtFormatted}</strong>
    </div>

    <div class="mb-2" id="ieu-days-remaining">
      <span class="text-muted">Kalan Süre:</span>
      <strong id="ieu-days-value">{ieuSubscription.daysRemaining} gün</strong>
    </div>

    <!-- Düşük gün uyarısı -->
    <!-- IF ieuSubscription.daysWarning -->
    <div class="alert alert-warning py-2 mb-2" id="ieu-days-warning">
      Aboneliğiniz {ieuSubscription.daysRemaining} gün sonra sona erecek!
    </div>
    <!-- ENDIF ieuSubscription.daysWarning -->

    <!-- İptal edilmiş durum -->
    <!-- IF ieuSubscription.cancelRequested -->
    <div class="alert alert-info py-2 mb-2" id="ieu-cancel-info">
      Otomatik yenileme iptal edildi.
      Aboneliğiniz {ieuSubscription.daysRemaining} gün sonra sona erecektir.
    </div>
    <!-- ENDIF ieuSubscription.cancelRequested -->

    <!-- ENDIF !ieuSubscription.statusFetchFailed -->

    <!-- İptal butonu — sadece autoRenew=true ve iptal edilmemişse -->
    <!-- IF ieuSubscription.showCancelButton -->
    <div id="ieu-cancel-action" class="mt-3">
      <button id="ieu-cancel-btn" class="btn btn-outline-danger btn-sm">
        Aboneliğimi İptal Et
      </button>
    </div>
    <!-- ENDIF ieuSubscription.showCancelButton -->

    <!-- AJAX sonuç alanı -->
    <div id="ieu-cancel-result" class="d-none mt-3"></div>

  </div>
</div>
<!-- ENDIF ieuSubscription.active -->
<!-- ENDIF isSelf -->
