async (page) => {
  const errors = [], checks = [];
  const mediaRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.resourceType() === 'media') mediaRequests.push(request.url());
  });
  const expect = async (value, message) => {
    if (!value) throw new Error(message);
    checks.push(message);
    await page.evaluate(result => { window.hospitalVideoProgress = result; }, checks);
  };
  await page.setViewportSize({ width: 1664, height: 1000 });
  // No query override: validate the actual production default source.
  await page.goto('http://localhost:5173/scripts/fixtures/nurse-silver-runtime.html');
  await page.waitForFunction(() => window.silverRuntime?.scene, null, { timeout: 60000 });
  await page.locator('.scene-switch-loader').waitFor({ state: 'hidden', timeout: 60000 });
  await page.waitForFunction(() => {
    const screen = window.silverRuntime.scene.nurseStationModel.getObjectByName('nurse-station-education-video');
    return screen.material.map?.isVideoTexture && screen.material.map.image.readyState >= 2;
  }, null, { timeout: 60000 });
  const media = await page.evaluate(() => {
    const screen = window.silverRuntime.scene.nurseStationModel.getObjectByName('nurse-station-education-video');
    const video = window.hospitalVideo = screen.material.map.image;
    window.hospitalVideoTexture = screen.material.map;
    window.hospitalVideoTime = video.currentTime;
    return { src: video.currentSrc, width: video.videoWidth, height: video.videoHeight,
      duration: video.duration, muted: video.muted, loop: video.loop, paused: video.paused, inline: video.playsInline };
  });
  await expect(media.src === 'http://localhost:5173/videos/nurse-station-care-loop.mp4?v=20260929-visible', 'bundled local video loaded without an external hospital source');
  await expect(media.muted && media.loop && media.inline && !media.paused, 'muted inline autoplay with loop enabled');
  await expect(Math.abs(media.width/media.height-16/9) < .01, 'native 16:9 video fits wall-mounted television');
  await expect(media.width === 640 && media.height === 360 && media.duration === 6, 'small 640x360 six-second loop');
  await page.waitForFunction(() => Math.abs(window.hospitalVideo.currentTime - window.hospitalVideoTime) > .5);
  await expect(true, 'decoded video playback advances');
  // Observe natural wraps, not forced seeks or just loop=true. Include decoder and presentation data.
  const playback = await page.evaluate(async () => {
    const video = window.hospitalVideo, start = video.getVideoPlaybackQuality();
    const events = { waiting: 0, stalled: 0, error: 0 };
    const listeners = Object.keys(events).map(name => {
      const listener = () => events[name]++;
      video.addEventListener(name, listener);
      return [name, listener];
    });
    const frames = { callbacks: 0, loops: 0, maxFrameGapMs: 0 };
    let previousMediaTime = video.currentTime, previousNow = performance.now(), callback;
    const onFrame = (now, metadata) => {
      frames.callbacks++;
      if (metadata.mediaTime < previousMediaTime - .5) frames.loops++;
      frames.maxFrameGapMs = Math.max(frames.maxFrameGapMs, now - previousNow);
      previousNow = now;
      previousMediaTime = metadata.mediaTime;
      callback = video.requestVideoFrameCallback(onFrame);
    };
    callback = video.requestVideoFrameCallback(onFrame);
    await new Promise(resolve => setTimeout(resolve, 13000));
    video.cancelVideoFrameCallback(callback);
    for (const [name, listener] of listeners) video.removeEventListener(name, listener);
    const end = video.getVideoPlaybackQuality();
    return { ...frames, totalFrames: end.totalVideoFrames - start.totalVideoFrames,
      droppedFrames: end.droppedVideoFrames - start.droppedVideoFrames, events };
  });
  await expect(playback.loops >= 2, 'video naturally repeats at least twice without seeking');
  await expect(playback.callbacks >= 100 && playback.maxFrameGapMs < 1000, 'video keeps presenting frames without a one-second freeze');
  await expect(playback.events.stalled === 0 && playback.events.error === 0, 'no stalled or error events during continuous playback');
  await expect(mediaRequests.length > 0 && mediaRequests.every(url => url.startsWith('http://localhost:5173/')), 'all video requests stay on the application origin');
  await page.evaluate(() => window.silverRuntime.scene.setActive(false));
  await expect(await page.evaluate(() => window.hospitalVideo.paused), 'inactive scene pauses hospital video');
  await page.evaluate(() => window.silverRuntime.scene.setActive(true));
  await page.waitForFunction(() => !window.hospitalVideo.paused);
  await expect(await page.evaluate(() => window.silverRuntime.scene.nurseStationModel.getObjectByName('nurse-station-education-video').material.map === window.hospitalVideoTexture), 'resume reuses the video texture');
  const titleDifference = await page.evaluate(async () => {
    const video = window.hospitalVideo, canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 360;
    const context = canvas.getContext('2d'), samples = [];
    video.pause();
    for (const time of [1, 4]) {
      await new Promise((resolve, reject) => {
        const done = () => { clearTimeout(timer); resolve(); };
        const timer = setTimeout(() => { video.removeEventListener('seeked', done); reject(new Error('video frame seek timed out')); }, 5000);
        video.addEventListener('seeked', done, { once: true });
        video.currentTime = time;
      });
      context.drawImage(video, 0, 0);
      samples.push(context.getImageData(20, 105, 340, 135).data);
    }
    let changed = 0;
    for (let i = 0; i < samples[0].length; i += 4) {
      const delta = Math.abs(samples[0][i] - samples[1][i]) + Math.abs(samples[0][i + 1] - samples[1][i + 1]) + Math.abs(samples[0][i + 2] - samples[1][i + 2]);
      if (delta > 100) changed++;
    }
    await video.play();
    return changed / (samples[0].length / 4);
  });
  await expect(titleDifference > .08, 'headline region visibly changes between the two three-second messages');
  await page.getByRole('button', { name: '隐藏所有信息面板', exact: true }).click();
  await page.evaluate(() => {
    const s = window.silverRuntime.scene;
    s.stationCameraInteracted = true;
    s.camera.position.set(3.4, 2.1, 13.1);
    s.controls.target.set(3.5, 2.22, 10.63);
    s.controls.update();
  });
  await page.waitForFunction(() => !window.hospitalVideo.seeking && window.hospitalVideo.readyState >= 2, null, { timeout: 60000 });
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => window.silverRuntime.setTheme(value), theme);
    await page.waitForFunction(value => window.silverRuntime.scene.darkTheme === (value === 'dark'), theme);
    await page.evaluate(async () => {
      await Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a => a.finished.catch(() => {})));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await expect(await page.evaluate(() => !window.hospitalVideo.paused && !window.hospitalVideo.error), `${theme} theme keeps video playing`);
    await page.screenshot({ path: `output/playwright/hospital-video-${theme}.png` });
  }
  await expect(errors.length === 0, `no uncaught errors: ${errors.join('; ')}`);
  await page.evaluate(report => { window.hospitalVideoReport = report; }, { media, playback, titleDifference, mediaRequests, checks, errors });
  await page.evaluate(() => { window.silverRuntime.setTheme('light'); window.silverRuntime.scene.resetToNurseStationView(); });
}
