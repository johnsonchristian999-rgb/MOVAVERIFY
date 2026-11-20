# MOVA VERIFY Global Verification MVP

A JavaScript-only React/Vite MVP for global verification account workflows. The UI follows the supplied Mova Verify reference. The default experience is **DEMO MODE**: wallet activity, sample orders and sample inbox messages are simulated, stored in the browser, and never represent real funds, phone numbers, inventory, SMS or completed payments.

## Requirements

- Node.js 20 or newer
- npm
- A Firebase project for authenticated/live backend features
- Twilio account and explicit approval for the intended number allocation and resale model before enabling number purchasing
- Paystack merchant account for Naira wallet funding

## Run the demo

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The app runs in demo mode with no credentials. Demo orders debit only the browser's simulated balance. The inbox labels all simulated content. Demo actions do not contact Twilio or Paystack.

## Verify

```sh
npm run build
npm test
npm run lint
```

## Firebase setup

1. Create a Firebase project and register a Web App. Enable Email/Password Authentication and Cloud Firestore.
2. Copy `.env.example` to `.env.local` and fill in the Firebase Web App fields. These are public client identifiers; no server secrets belong in Vite variables.
3. Install Functions dependencies with `npm --prefix functions install`.
4. Deploy Firestore rules, indexes, and functions with the Firebase CLI after selecting your project: `firebase use <project-id>` then `firebase deploy`.
5. Set up Firebase App Check before using callable backend operations.
6. Assign administrator access only with server-side Firebase custom claims. Never trust a client-side admin flag.

The rules deny direct client writes to wallets, orders, messages, transactions, payments and admin settings. Backend functions use the Admin SDK for trusted mutations.

## Paystack setup

Set `PAYSTACK_SECRET_KEY` through Firebase Functions Secret Manager. The client never receives or uses this key. Funding starts from an authenticated callable function, then the backend verifies the transaction directly with Paystack before an idempotent Firestore transaction credits the wallet. Configure the deployed `paystackWebhook` endpoint in Paystack and require the HMAC signature check. Do not mark a client redirect as proof of payment.

## Twilio setup and compliance gate

Before enabling live number purchasing, verify Twilio's current terms and get written approval for the intended number allocation, verification and resale model. Keep `TWILIO_RESALE_APPROVED` unset/false until approved. Store `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `MOVA_VERIFY_TWILIO_SMS_WEBHOOK_URL` in Functions environment/secrets, not in `.env.local` or frontend code. Configure and test the signed inbound SMS webhook. Live purchasing fails closed when approval, credentials, catalog pricing, or provider inventory are unavailable.

Provider exceptions after an allocation attempt leave the wallet debit reserved and the order in `provider_review`; reconcile provider state before refunding to avoid duplicate number purchases or double credits.

## Project contents

- `src/`: JavaScript React UI, routes, auth, Firebase client and Firestore services
- `functions/`: JavaScript Cloud Functions, Paystack verification, and guarded Twilio provider adapter
- `firestore.rules`: user isolation and server-only financial/provider writes
- `firestore.indexes.json`: indexes for user order and inbox queries
- `.env.example`: public Firebase client fields and server-secret reminders

## Current limitations

Live authentication and Firestore require Firebase project configuration and deployment. Paystack requires merchant credentials and webhook configuration. Twilio purchasing remains intentionally unavailable until provider approval, server credentials, catalog setup, and webhook configuration are complete. No credentials were provided, so this workspace cannot validate external payments or phone-number allocation.
