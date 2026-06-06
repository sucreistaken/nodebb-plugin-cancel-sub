# nodebb-plugin-cancel-sub

NodeBB plugin that provides a clean, user-facing **email subscription cancel flow**.

Designed to be the landing page for `List-Unsubscribe` headers and unsubscribe links inside bulk emails sent from NodeBB (e.g. via [`announcement-mailer`](https://github.com/sucreistaken/announcement-mailer)). Without this, users who click "unsubscribe" land on a generic NodeBB account-settings page and abandon the cancel; with this, they get a one-click confirmation page that actually completes the opt-out and tells them what they unsubscribed from.

## What it does

- Public route (no login wall): `/unsubscribe/:token`
- Token validates without exposing the user's email or NodeBB session
- Confirmation page: "You've been unsubscribed from <category>. Resubscribe."
- Audit log entry for the cancel event
- Idempotent: clicking the link twice is fine

## Install

```bash
cd /path/to/nodebb
npm install nodebb-plugin-cancel-sub
./nodebb activate nodebb-plugin-cancel-sub
./nodebb build
./nodebb restart
```

## Pair with

[`announcement-mailer`](https://github.com/sucreistaken/announcement-mailer) — generates the tokenized unsubscribe URL that points at this plugin's route.
