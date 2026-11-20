# Publish LIHPS Sprint Mechanics on GitHub Pages

This folder is the upload-ready application. Keep it in its own repository so the H-Test app keeps its existing address and files.

## First publication

1. Unzip the release package on your Mac and open the extracted folder.
2. Sign in to GitHub and create a new repository named `lihps-sprint-mechanics` (or another name you prefer). GitHub Pages is available for public repositories on GitHub Free; availability for private repositories depends on your plan. Do not add a starter README, licence, or `.gitignore`, because this package already contains the documentation and ignore rules.
3. In the repository, choose **Add file → Upload files**. Drag the **contents of the extracted folder** into the upload area. Do not drag its enclosing folder or upload the ZIP. Keep `vendor`, `icons`, `tests` and `scripts` as folders.
4. Include the hidden `.nojekyll`, `.gitignore` and `.gitattributes` files. On a Mac, press **Command–Shift–.** in Finder to show hidden files. You can also create `.nojekyll` on GitHub with **Add file → Create new file**, enter `.nojekyll` as the name, and commit an empty file.
5. Commit the files to the `main` branch. Check that **index.html** is visible immediately in the repository's top-level file list, alongside `app.js`, `vendor` and `icons`.
6. Open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, then **main** and **/(root)**. Click **Save**.
7. Wait for GitHub's Pages deployment to finish. The Pages settings will show the live address. Use that exact address, including the repository name and trailing slash.

The app does not need a custom domain, a build step, Git LFS, or any secrets. `.nojekyll` tells Pages to serve the static files directly. The bundled files are individually smaller than GitHub's 25 MiB browser-upload limit, and the package contains fewer than 100 files.

## Check the published app

1. Open the HTTPS address and check that the header reads **PREVIEW 0.2**.
2. Expand **Recording guide, score definitions and offline use**, choose **Check offline readiness**, and wait for all application, model and decoder assets to be cached.
3. Import a short original sprint clip, process it once, and review the tracking and events.
4. Confirm all five event frames, the swing interval and phase landmarks. Choose **Analyse confirmed frames**. Check that proposals appear with **Confirm / Refute** controls, while visual items retain manual choices.
5. Save a clearly labelled test assessment, export its CSV and check the print preview. Reopen the saved assessment and reattach its original video to confirm that the selected frames and markers remain available.
6. If offline use matters, reopen and process a short original clip with networking switched off after the readiness check passes.

## Existing assessments and privacy

The GitHub Pages address is a different website address from the previous hosted preview. Assessments saved at the previous address remain there and do not automatically appear on GitHub Pages. Export CSV records and retain original videos before switching. CSV records cannot currently be imported as editable assessments.

Only application files belong in this repository. The package contains no athlete recordings, exported assessments, credentials, private hosting settings or Git history. Future recordings and exports are also covered by the supplied `.gitignore` when using Git; browser uploads must still be selected deliberately.

GitHub Pages generally serves a publicly accessible website. The app's video and assessment processing remains local to the browser; publishing does not add a sign-in or cloud assessment database.

## Update later

Save any open assessment before refreshing. Replace the application files with the next complete release, including `sw.js`, `vendor/` and all versioned scripts. Commit the update and wait for Pages to finish deploying. Open online and check the displayed version and offline readiness. Do not clear browser data to update: that can remove saved assessments.

For code changes, update the application version, changed asset query strings and service-worker cache name together. Run `npm test`, regenerate `SHA256SUMS.txt` with `npm run checksum`, then run `npm run check`. No dependency installation is required for the supplied checks.

## Troubleshooting

- **404:** check that Pages uses `main` and `/(root)`, and that `index.html` is at the top level.
- **Missing model or decoder:** upload the complete `vendor/` folder, keeping filenames and capitalization unchanged. Use the HTTPS Pages address, not a local file opened from Finder.
- **Old interface:** save first, reopen online and refresh after the new offline cache has installed. Check the version before continuing.
- **Incomplete offline preparation:** keep the app online until the readiness check passes. Browser storage can be evicted, so retain exported records and original videos separately.

## Official GitHub references

- [Configure the Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Upload files and browser-upload limits](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)
