async (page) => {
  await page.waitForFunction(() => {
    const screen = window.silverRuntime?.scene?.nurseStationModel?.getObjectByName('nurse-station-education-video');
    return screen?.material.map?.isVideoTexture && screen.material.map.image.readyState >= 2;
  }, null, { timeout: 60000 });
  const report = await page.evaluate(async () => {
    const video = window.silverRuntime.scene.nurseStationModel.getObjectByName('nurse-station-education-video').material.map.image;
    const quality = video.getVideoPlaybackQuality();
    const start = { time: performance.now(), paused: video.paused, frames: quality.totalVideoFrames, dropped: quality.droppedVideoFrames };
    let previousTime = video.currentTime, mediaAdvance = 0;
    const trackTime = () => {
      const currentTime = video.currentTime;
      mediaAdvance += currentTime - previousTime + (currentTime < previousTime ? video.duration : 0);
      previousTime = currentTime;
    };
    video.addEventListener('timeupdate', trackTime);
    const events = { waiting: 0, stalled: 0, error: 0 };
    const listeners = Object.keys(events).map(name => {
      const listener = () => events[name]++;
      video.addEventListener(name, listener);
      return [name, listener];
    });
    await new Promise(resolve => setTimeout(resolve, 10000));
    trackTime();
    video.removeEventListener('timeupdate', trackTime);
    for (const [name, listener] of listeners) video.removeEventListener(name, listener);
    const end = video.getVideoPlaybackQuality();
    return { src: video.currentSrc, width: video.videoWidth, height: video.videoHeight, duration: video.duration,
      sampleSeconds: (performance.now() - start.time) / 1000, mediaAdvance, initiallyPaused: start.paused, paused: video.paused,
      totalFrames: end.totalVideoFrames - start.frames, droppedFrames: end.droppedVideoFrames - start.dropped,
      readyState: video.readyState, events };
  });
  await page.evaluate(value => { window.stationVideoMeasurement = value; }, report);
}
