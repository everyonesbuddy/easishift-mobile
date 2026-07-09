# WiserShifts Mobile Deployment Guide

This document is the reference guide for releasing WiserShifts Mobile to:

- Apple App Store
- Google Play Store

It is written for this Expo / EAS project and assumes the app is built from this repository.

---

## 1. Release Stack Used by This Project

This app is deployed using:

- Expo
- EAS Build
- EAS Submit
- App Store Connect for iOS
- Google Play Console for Android

Current project linkage:

- Expo owner: `wisershifts2026`
- Expo project slug: `wiser-shifts-mobile`
- EAS project ID is already configured in `app.json`

Relevant files in this repo:

- `app.json` for app metadata, bundle/package identifiers, icons, splash, and Expo config
- `eas.json` for build and submit profiles
- `package.json` for project scripts

---

## 2. Accounts and Access Required

Before release work starts, confirm access to all of the following:

### Apple

- Apple Developer Program membership approved and active
- App Store Connect access
- Rights to create apps, certificates, and submit builds

Useful links:

- Apple Developer Program: https://developer.apple.com/programs/
- Apple Developer Account: https://developer.apple.com/account/
- App Store Connect: https://appstoreconnect.apple.com/

### Google

- Google Play Console account active
- Play Console identity verification complete
- Rights to create apps and manage releases

Useful links:

- Google Play Console: https://play.google.com/console/
- Play Console Help: https://support.google.com/googleplay/android-developer/
- Play Policy Center: https://support.google.com/googleplay/android-developer/topic/9877466

### Expo

- Expo account access for `wisershifts2026`
- `eas-cli` installed locally
- Logged in with `eas login`

Useful links:

- Expo dashboard: https://expo.dev/
- EAS Build docs: https://docs.expo.dev/build/introduction/
- EAS Submit docs: https://docs.expo.dev/submit/introduction/

---

## 3. One-Time Local Setup

Run these commands from the project root:

```bash
npm install
npm install -g eas-cli
eas login
eas init
eas build:configure
```

### Windows note

If PowerShell blocks `eas` with an execution policy error, either:

```powershell
eas.cmd login
eas.cmd init
eas.cmd build:configure
```

or use `cmd` instead of PowerShell.

If `eas` is not found, use:

```bash
npx eas-cli login
npx eas-cli init
npx eas-cli build:configure
```

For this repository, `eas init` and `eas build:configure` have already been completed.

---

## 4. Required App Configuration Before the First Store Build

The most important remaining setup is defining the permanent app identifiers in `app.json`.

### iOS bundle identifier

Add under `expo.ios`:

```json
"bundleIdentifier": "com.yourcompany.wisershifts"
```

### Android package name

Add under `expo.android`:

```json
"package": "com.yourcompany.wisershifts"
```

### Important rules

- Use the same values everywhere: local config, App Store Connect, and Google Play Console
- These identifiers should be treated as permanent after release
- Prefer reverse-domain format, such as `com.companyname.appname`
- Do not use spaces, uppercase letters, or changing trial names

Example:

```json
{
  "expo": {
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.wisershifts.mobile"
    },
    "android": {
      "package": "com.wisershifts.mobile"
    }
  }
}
```

### Other config to verify in `app.json`

- `name`
- `slug`
- `version`
- `scheme`
- app icon paths
- splash screen paths
- permissions added by plugins or libraries

---

## 5. Store Listings to Create

Create the app entries before the first production submission.

### Apple App Store Connect

Create a new app record with:

- App name
- Primary language
- Bundle ID matching `app.json`
- SKU value you choose for internal tracking

### Google Play Console

Create a new app record with:

- App name
- Default language
- App or game selection
- Free or paid selection
- Package name matching `app.json`

---

## 6. Metadata and Assets Required for Both Stores

Prepare these before submission:

- Final app name
- Short description
- Full description
- Category
- Support URL
- Privacy policy URL
- Marketing URL if available
- App icon
- Screenshots for required device sizes
- Release notes / What\'s New text

### Recommended asset checklist

- iPhone screenshots
- Android phone screenshots
- 1024 x 1024 app icon
- Feature graphic for Google Play if needed

Keep all release assets in a shared design folder so each release does not start from scratch.

---

## 7. Compliance and Policy Items

These forms are mandatory and often cause the first release delay.

### Apple

Complete:

- App Privacy questionnaire
- Age Rating questionnaire
- Export Compliance questions
- App Review notes

If your app requires login, provide:

- demo credentials
- steps for reviewers to reach important screens

### Google

Complete:

- Data Safety form
- Content rating questionnaire
- App access instructions if login is required
- Ads declaration
- Target audience and content section if relevant

### Important warning

Policy answers must match the actual app behavior and SDK usage. If the app sends analytics, stores auth tokens, accesses camera, photos, notifications, or location, the declarations must reflect that.

---

## 8. Versioning Rules

This project currently uses:

- app version in `app.json`
- automatic build number increment in `eas.json` production profile

### Version values to manage

- User-facing app version: `expo.version`
- iOS build number: handled by EAS when `autoIncrement` is enabled
- Android version code: handled by EAS when `autoIncrement` is enabled

### Recommended release version pattern

- `1.0.0` for first release
- `1.0.1` for bug fixes
- `1.1.0` for minor feature releases
- `2.0.0` for major changes

Before each release, update the version in `app.json` if the release should appear as a new version to users.

---

## 9. Build Profiles in This Project

Current `eas.json` profiles:

- `development`
- `preview`
- `production`

Current production behavior:

- `autoIncrement: true`

Typical usage:

```bash
eas build -p android --profile production
eas build -p ios --profile production
```

---

## 10. Recommended Release Order

Use this order every time.

### Shared pre-release steps

Run:

```bash
npm run lint
```

Then manually test:

- app launch
- login
- logout
- navigation between public and protected routes
- API-backed screens
- schedule features
- messaging
- time-off flows
- billing/paywall flow if enabled

Then increase the user-facing version in `app.json` when appropriate.

### Android track (Google Play)

1. Build Android production:

```bash
eas build -p android --profile production
```

2. If prompted on first build, allow EAS to create/manage the Android keystore.
3. Upload to internal testing with EAS Submit or Play Console.
4. Validate on a real Android device.
5. Roll out using staged production release.

### iOS track (Apple App Store)

1. Wait until Apple Developer membership is approved.
2. Build iOS production:

```bash
eas build -p ios --profile production
```

3. If prompted on first build, allow EAS to create/manage certificates and provisioning profiles.
4. Distribute via TestFlight.
5. Validate on a real iPhone.
6. Submit for App Review in App Store Connect.

### Submit commands

```bash
eas submit -p android
eas submit -p ios
```

You can also upload manually in each store console if needed.

---

## 11. First Android Release Checklist

Use this before pressing release in Google Play Console.

- `app.json` has final Android package name
- Google Play app exists with matching package name
- privacy policy URL is live
- Data Safety form is completed accurately
- content rating is completed
- app access instructions are provided if login is required
- screenshots are uploaded
- release notes are written
- production AAB was built successfully
- internal testing passed on a real Android device

### Android build command

```bash
eas build -p android --profile production
```

### Android submit command

```bash
eas submit -p android
```

### Android rollout recommendation

For the first public release, use staged rollout instead of sending to 100% immediately.

---

## 12. First iOS Release Checklist

Use this before submitting to App Review.

- Apple Developer membership is approved
- `app.json` has final iOS bundle identifier
- App Store Connect app exists with matching bundle ID
- app privacy form is completed accurately
- age rating is completed
- export compliance questions are answered
- support URL and privacy policy URL are live
- screenshots are uploaded
- review notes are written
- demo login credentials are prepared if login is required
- production IPA was built successfully
- TestFlight validation passed on a real iPhone

### iOS build command

```bash
eas build -p ios --profile production
```

### iOS submit command

```bash
eas submit -p ios
```

### iOS review note recommendation

Always include:

- what the app does in one sentence
- how a reviewer can log in
- anything they must tap first
- whether some features depend on tenant or role permissions

---

## 13. Real-Device QA Checklist Before Any Submission

Do not rely only on simulator or emulator testing.

Test on real devices:

- cold launch after fresh install
- login and logout
- password reset if supported
- protected route access
- network failure handling
- session persistence after app restart
- push notifications if implemented
- deep linking if implemented
- billing flow if enabled
- any camera, file upload, or media permission flow if implemented

Also test:

- one slow network scenario
- one expired token scenario
- one fresh install after previous version uninstall

---

## 14. Common First-Release Failure Points

### Configuration mismatches

- Bundle ID in Apple does not match `app.json`
- Package name in Google does not match `app.json`
- Wrong app icon or splash asset path

### Policy mismatches

- Privacy declarations do not match SDK usage
- Data Safety answers are incomplete
- Login-required app has no reviewer access instructions

### Release process issues

- Trying to release without testing in TestFlight or Internal Testing
- Forgetting to increment version for user-facing release
- Missing privacy policy URL
- Broken support link

### Windows tooling issues

- PowerShell blocks global npm command shims like `eas.ps1`
- Fix by using `cmd`, `eas.cmd`, or `npx eas-cli`

---

## 15. Recommended Release Routine for This Project

Follow this for each new version.

1. Merge release-ready changes to the main branch you build from.
2. Run `npm install` if dependencies changed.
3. Run `npm run lint`.
4. Update `expo.version` in `app.json` if needed.
5. Build Android production artifact.
6. Build iOS production artifact.
7. Validate the builds on real devices.
8. Submit Android to internal or production track.
9. Submit iOS to TestFlight or App Review.
10. Monitor store processing, review feedback, and crash reports.

---

## 16. Commands Reference

### Local setup

```bash
npm install
npm install -g eas-cli
eas login
eas init
eas build:configure
```

### Build production

```bash
eas build -p android --profile production
eas build -p ios --profile production
```

### Submit production

```bash
eas submit -p android
eas submit -p ios
```

### Lint

```bash
npm run lint
```

### Windows fallback commands

```bash
eas.cmd login
eas.cmd init
eas.cmd build:configure
```

or:

```bash
npx eas-cli login
npx eas-cli init
npx eas-cli build:configure
```

---

## 17. What Still Needs To Be Done in This Repository

As of the current setup, these are the known next actions:

1. Confirm the chosen identifiers are final and keep them unchanged:

- iOS `bundleIdentifier`: `com.wisershifts.mobile`
- Android `package`: `com.wisershifts.mobile`

2. Create the Google Play app record using the same package name.
3. Wait for Apple Developer approval, then create the App Store Connect app using the same bundle ID.
4. Prepare privacy policy, support URL, screenshots, and store descriptions.
5. Run the first Android production build.
6. Run the first iOS production build after Apple approval.

---

## 18. Suggested First Release Sequence for WiserShifts Mobile

Because Google Play is already active and Apple approval is still pending, the practical release sequence is:

1. Keep the configured identifiers in `app.json` unchanged.
2. Create the Google Play listing.
3. Complete Google Play policy forms.
4. Build Android production.
5. Test Android internally.
6. When Apple approves the account, create the iOS app record.
7. Build iOS production.
8. Test through TestFlight.
9. Submit both stores for public release.

---

## 19. Useful Reference Links

### Expo

- https://expo.dev/
- https://docs.expo.dev/build/introduction/
- https://docs.expo.dev/submit/introduction/
- https://docs.expo.dev/distribution/app-stores/

### Apple

- https://developer.apple.com/programs/
- https://developer.apple.com/account/
- https://appstoreconnect.apple.com/
- https://developer.apple.com/app-store/review/guidelines/
- https://developer.apple.com/help/app-store-connect/manage-app-information/

### Google

- https://play.google.com/console/
- https://support.google.com/googleplay/android-developer/
- https://support.google.com/googleplay/android-developer/topic/9858052
- https://support.google.com/googleplay/android-developer/answer/9859348

---

## 20. Maintenance Note

Update this document whenever:

- bundle/package identifiers change before first release
- store requirements change
- billing, notifications, permissions, or login flows change in ways that affect policy answers
- the build or submit process changes

This file should remain the single internal reference for mobile app release operations.
