# LIHPS Sprint Mechanics

Browser-based sprint video review with examiner-confirmed Sprint Mechanics Assessment Score (S-MAS) scoring. Preview 0.2.0.

The app processes camera-original MOV/MP4 clips on the device using MediaPipe Full. Review and correct the landmarks, confirm five sprint events, and choose **Analyse confirmed frames** to generate proposals without processing the video again. Confirm or refute supported proposals and enter visual decisions for the remaining items. Save assessments locally, export CSV, or print a report.

## Publish on GitHub Pages

1. Create a separate repository, for example `lihps-sprint-mechanics`.
2. Upload the **contents of this folder** to the repository root. `index.html`, `app.js`, `icons/` and `vendor/` must be at the top level. Include `.nojekyll`; do not upload the ZIP itself.
3. Open **Settings → Pages**. Set **Source: Deploy from a branch**, **Branch: main**, **Folder: /(root)**, then save.

No build, package installation, API key, server, or custom GitHub Actions workflow is needed. The files use relative URLs and work under a repository address such as `https://YOUR-USERNAME.github.io/lihps-sprint-mechanics/`.

See [PUBLISHING.md](PUBLISHING.md) for step-by-step setup, updates, and troubleshooting, or [GitHub's publishing-source instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Use

Open the published HTTPS address in a current Safari or Chrome browser with WebCodecs support. On iPhone, you can add it to the Home Screen. Read [USER_GUIDE.md](USER_GUIDE.md) for recording setup, scoring, marker correction and offline preparation.

Videos, landmarks and assessment details are not uploaded by the application. Local saves contain landmarks and small phase images, not the original video. Saved assessments belong to the current browser and website address; keep the originals and export records before clearing browser storage or moving to a different address. The hosting provider receives ordinary website requests.

## Scope

This preview supports outdoor and indoor overground sprint footage. It has not been clinically validated. Phase detection, tracking flags and score proposals are engineering assistance; all final scores require examiner decisions. Rotation, pelvic/lumbar posture, foot inclination and collapse remain visual judgments. It does not calculate injury probability, determine return-to-sport readiness, or compute running speed from calibration marks.

## Checks

With Node.js 20 or newer:

```sh
npm test
npm run check
```

There are no npm dependencies to install. The tests use simulated adapters; they do not establish model accuracy or physical-device compatibility. A release inventory is in [SHA256SUMS.txt](SHA256SUMS.txt).

## Credits and licences

S-MAS criteria are adapted from Bramah et al. (2024), under CC BY-NC 4.0, with shortened wording and no implied endorsement. MediaPipe and Mediabunny retain their upstream licences. See [THIRD_PARTY.md](THIRD_PARTY.md) and [LICENSING.md](LICENSING.md). No article photographs are included.
