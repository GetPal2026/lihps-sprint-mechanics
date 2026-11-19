# LIHPS Sprint Mechanics 0.1.0

An English-language, separate web app for examiner-confirmed Sprint Mechanics Assessment Score (S-MAS) review. All video decoding and MediaPipe Full analysis run in the browser. No original videos, landmarks, scores or assessment details are sent to any server by the app.

## Use on iPhone

1. Open the provided HTTPS app address in current Safari. For an installed app, choose Share, Add to Home Screen, and enable Open as Web App. The icon is labelled Sprint S-MAS.
2. While online, expand Recording guide, score definitions and offline use. Choose Check offline readiness and wait for confirmation that the app, model and decoder are cached. The initial download is approximately 33 MB. Storage is separate for each browser, installed app and origin. Recheck from the Home Screen installation itself.
3. Enter an athlete ID, date and assessor; the other assessment details are optional. Record measured running speed separately if available. This version does not compute speed from video or calibration marks.
4. Choose one or both camera-original MOV or MP4 clips. Left side means the anatomical left side being assessed, not the left of the screen. Obtain clear views of each side in separate trials. Both limbs appear in several criteria, including the opposite trailing limb.
5. Check the preview and use Rotate 90° if necessary, then Process left video, Process right video or Process both videos. Both inputs are not required. When a second clip is added later, only the unprocessed clip is analysed; existing scoring on the other side is retained. Keep the app open during processing.
6. Confirm running direction and enter the camera's capture-rate setting. The app reports decoded playback cadence separately; neither the entered rate nor the playback cadence proves that all originally captured frames were retained.
7. Select an automatically suggested sequence if available. Inspect the five events using View, the slider, Previous frame and Next frame. Set current frame assigns and confirms the displayed frame for that event. Confirm frame accepts an automatic suggestion after your inspection. All five must be in chronological order. If suggestions fail, set the five events manually.
8. Use Review interval to inspect the whole interval from maximal vertical projection to late swing, then explicitly check I reviewed the full interval.
9. Choose Absent (0), Present (1), or Unable for every observation. Items unlock once their relevant phase or interval and event order are confirmed. A complete /12 score requires all twelve numeric decisions, all five confirmed phases, and interval review. Unscored or unable observations never silently become zero.
10. For tracking review, expand Landmark correction and tracking review. Select the anatomical side and landmark, then tap its position on the frame. Reset frame landmarks recovers the original estimate, including an original missing estimate. Corrections apply only to that frame and clear scores and phase confirmations for the assessed side. The chosen landmark stays selected while stepping. Next flagged stretch and Mark stretch reviewed organise review; acknowledgement does not validate or correct tracking.
11. Save on this device stores this assessment in this browser, with landmarks and small phase images. Original videos are not stored. To resume full video review after reopening, reattach originals with the same filename and size. Keep the original files. Export CSV and Print / save PDF provide separate records; CSVs and reports contain athlete data.

## Recording

The Bramah protocol uses two maximal-effort 35 m overground sprints following warm-up and progressive runs, recorded at 240 fps. Capture the 25–30 m zone using a stationary camera 7 m perpendicular to the zone at 0.8 m height. Show the entire body and ground, in good lighting, with a clear view of each side. A 5 m timing-gate interval can supply a manually entered speed. Treadmill assessments are outside this version's scope.

## Interpretation and engineering limits

The score descriptions follow the authors' 2024 criteria. Thresholds such as 45°, 15° and 20° retain their original contexts; all scoring is examiner confirmed. The MediaPipe shoulder–hip line is a labelled proxy for trunk lean, not the published greater-trochanter-to-C7 reference. Pelvic tilt, lumbar extension, rotation, shoe-ground gaps and centre of mass are not directly measured. Supporting 2D geometry never awards points.

Automatic events are unvalidated engineering suggestions. The detector uses projected foot height, ankle stationarity, pelvic height, knee extension and hip–ankle alignment in a fixed-camera overground sequence. A moving camera, occlusion, wrong-leg tracking, low pixel resolution or poor ground visibility can defeat it. It may offer no sequence; manual event assignment remains available.

Tracking flags use confidence, projected segment-length changes and timestamp gaps. They can miss plausible but incorrect tracking, and projected lengths legitimately vary with perspective. Midstance, toe-off and touchdown suggestions are not force-plate events. The app does not report contact times, flight times, instantaneous speed, acceleration, or angular velocity.

Video timestamp labels follow file presentation time. Slow-motion exports may retime or drop frames. No real-time biomechanical time base is inferred from a capture-rate label. Use camera-original recordings and inspect the retained frames.

Left/right comparison is an absolute point difference, not a percentage or LSI. One-point differences may fall within the published measurement error. The app does not calculate injury probability, apply an injury-risk cutoff, or determine return-to-sport readiness. It has not been clinically validated.

Each assessed side uses one selected sequence. Additional sequences are alternatives and replacing the selected sequence clears that side's scoring; this version does not average or take the worst score across strides.

MediaPipe Full and decoder resources are bundled and version pinned. See `dist/THIRD_PARTY.md` and vendor licences. S-MAS wording is adapted under CC BY-NC 4.0 with attribution; original article photographs are not included.
