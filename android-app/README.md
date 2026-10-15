# Macros — Android APK

This folder wraps the web app in `../macros` as an installable Android app using [Capacitor](https://capacitorjs.com).
The app files are bundled inside the APK, so it works offline. Barcode lookups still need internet.

## Download and install
Every push that changes `macros/` or `android-app/` triggers the **Build Macros APK** GitHub Action, which publishes a GitHub Release.

On your phone, open this link to get the newest build:
**https://github.com/ripemgineer/my-project/releases/latest/download/Macros.apk**

1. Open the downloaded `Macros.apk`. If Android asks, allow your browser or Files app to **install unknown apps**.
2. Tap **Install**. If Play Protect warns that the app is unrecognized, tap **More details → Install anyway**. That's expected for apps not from the Play Store.
3. Open Macros and allow the camera the first time you scan.

To update, download and install the newest APK the same way. Your data stays on the phone.

## Signing key (one-time setup)
Android only installs an update over an existing app if both are signed with the **same key**.
Add these repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `MACROS_KEYSTORE_BASE64` | base64 of a PKCS12 keystore with key alias `macros` |
| `MACROS_KEYSTORE_PASSWORD` | the keystore/key password |

Without them, the workflow still builds a working APK but signs it with a throwaway key. You'd then need to uninstall the old app before installing a new build, which erases its data, so export a backup first.

To create a key yourself:
```sh
keytool -genkeypair -keystore macros.p12 -storetype PKCS12 -alias macros -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Macros"
base64 -w0 macros.p12   # paste the output into MACROS_KEYSTORE_BASE64
```
Keep `macros.p12` and its password somewhere safe, and never commit them.

## Building locally (optional)
Requires Node 22+, JDK 21 and the Android SDK.
```sh
npm ci
npm run sync                 # copies ../macros into www/ and syncs the Android project
cd android && ./gradlew assembleDebug
```
