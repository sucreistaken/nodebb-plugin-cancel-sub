<div class="acp-page-container">
	<div class="col-lg-9">
		<div class="card">
			<div class="card-header fw-semibold">IEU Cancel Subscription</div>
			<div class="card-body">
				<form role="form" class="ieu-cancel-subscription-settings">
					<div class="mb-3">
						<label class="form-label" for="subscriptionServiceUrl">Subscription Service URL</label>
						<input type="text" id="subscriptionServiceUrl" name="subscriptionServiceUrl"
							class="form-control" placeholder="https://forum.ieu.app" />
						<p class="form-text">
							Abonelik servisinin base URL'i. Aynı makinede ise <code>http://localhost:3000</code> kullanılabilir.
						</p>
					</div>

					<div class="mb-3">
						<label class="form-label" for="apiTimeout">API Timeout (ms)</label>
						<input type="number" id="apiTimeout" name="apiTimeout"
							class="form-control" placeholder="5000" />
						<p class="form-text">
							Servis isteklerinin zaman aşımı süresi (milisaniye).
						</p>
					</div>

					<hr />

					<h5>Grup Adları</h5>
					<p class="text-muted">NodeBB'deki abonelik plan gruplarının slug değerleri.</p>

					<div class="mb-3">
						<label class="form-label" for="liteGroupName">Lite Grup Adı</label>
						<input type="text" id="liteGroupName" name="liteGroupName"
							class="form-control" placeholder="lite" />
					</div>

					<div class="mb-3">
						<label class="form-label" for="premiumGroupName">Premium Grup Adı</label>
						<input type="text" id="premiumGroupName" name="premiumGroupName"
							class="form-control" placeholder="premium" />
					</div>

					<div class="mb-3">
						<label class="form-label" for="vipGroupName">VIP Grup Adı</label>
						<input type="text" id="vipGroupName" name="vipGroupName"
							class="form-control" placeholder="vip" />
					</div>
				</form>
			</div>
		</div>
	</div>
</div>

<button id="save" class="floating-button mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored">
	<i class="material-icons">save</i>
</button>

<script>
	require(['settings'], function (Settings) {
		Settings.load('ieu-cancel-subscription', $('.ieu-cancel-subscription-settings'));

		$('#save').on('click', function () {
			Settings.save('ieu-cancel-subscription', $('.ieu-cancel-subscription-settings'), function () {
				app.alertSuccess('Settings Saved');
			});
		});
	});
</script>
