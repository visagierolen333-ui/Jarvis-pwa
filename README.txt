# J.A.R.V.I.S. PWA — Quick Start

A lightweight, installable personal assistant for Android and other modern browsers. It includes offline time/date and arithmetic commands, optional speech recognition, spoken answers, local weather, DuckDuckGo search, and optional Gemini Developer API integration.

## Host for free with GitHub Pages

1. Create a public GitHub repository (for example, `jarvis-pwa`).
2. Upload the files in this project to the repository root: `index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.webmanifest`, `icon.svg`, and `README.txt`.
3. Commit the files to the default branch.
4. Open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select your default branch and **/(root)**, then save.
5. When deployment finishes, open the Pages URL in Chrome on your phone. The site must use HTTPS for installation, microphone, and location permissions.

## Install on Android

1. Open the HTTPS Pages URL in Chrome (not an in-app browser).
2. Use Chrome’s menu and select **Install app** or **Add to Home screen**.
3. Open JARVIS and tap **Activate voice** to request microphone permission.
4. Say **“Hey Jarvis, what time is it?”** or **“Hey Jarvis, calculate 18 times 7.”** You can also type commands.
5. Allow location only if you want local weather.

## Commands

- **Time and date:** “What time is it?” / “What’s today’s date?”
- **Arithmetic:** “Calculate 18 times 7” (also supports `+`, `-`, `*`, `/`, `%`, powers, parentheses, and spoken operator names)
- **Weather:** “Weather” (uses device location and Open-Meteo; no weather API key)
- **Web search:** “Search for XAUUSD gold price” (opens DuckDuckGo)
- **Help:** “Help”
- General questions use Gemini only when an API key is configured and the device is online.

## Optional online AI

1. Create a Gemini Developer API key in [Google AI Studio](https://aistudio.google.com/apikey) for a project that remains on the Free Tier.
2. Do not enable billing or upgrade the project if you require a strict zero-cost setup. Model availability, quotas, and terms can change.
3. In JARVIS, open **Online AI Configuration**, enter the key and model, and choose **Save on this device**. The default model is `gemini-2.5-flash`; change it in settings if it is unavailable to your project.
4. Use **Remove key** to delete it from this browser.

**Security:** A browser API key is not secret. Anyone with access to the browser profile or device app data may be able to retrieve it. Never commit or publish your key. If exposed, revoke it in Google AI Studio. Google may process prompts under its applicable terms.

## Important limitations

- Installability and microphone/location permissions require HTTPS (or localhost).
- Speech recognition support varies by browser. Chrome on Android is a good starting point, but recognition may send audio to the browser’s speech service and may require internet.
- “Hey Jarvis” is only a phrase filter while the page is open, foregrounded, and the microphone session is active. It is not an always-on hotword and will not work with the phone locked or app closed.
- Offline mode is a small command engine, not a fully offline language model. Time/date and calculations work without a network connection; weather, web search, and Gemini need internet.
- This project has no ads, paid libraries, or built-in subscription. Browser speech services and Google’s AI service are subject to their own terms and availability.

## Troubleshooting

- **No microphone:** Open the HTTPS site in Chrome and check Android **Settings → Apps → Chrome → Permissions → Microphone**.
- **Voice does not hear:** Keep the page open, tap **Activate voice**, speak clearly, and include “Hey Jarvis.” Browser speech engines can stop after silence; tap again if needed.
- **Weather unavailable:** Allow location, enable device location services, and check internet access.
- **AI error:** Check the API key, selected model, internet connection, project tier, and available quota in AI Studio. Never enable billing if you require a zero-cost setup.
- **App does not update:** Close and reopen it. If needed, clear the site’s storage/cache and reload.
