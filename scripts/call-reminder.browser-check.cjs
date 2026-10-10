async page => {
  const assert = (value, message) => { if (!value) throw Error(message); };
  const url = 'http://127.0.0.1:5173/scripts/fixtures/nurse-light-command.html?clinical';
  await page.goto(url);
  const second = await page.context().newPage();
  await second.goto(url);
  const setup = async tab => tab.evaluate(() => {
    window.reminderProbe = {sounds:0, notifications:0, failSound:false};
    class ProbeAudio {
      state = 'running'; currentTime = 0; destination = {};
      constructor() { window.reminderProbe.sounds++; if (window.reminderProbe.failSound) throw Error('blocked test audio'); }
      createGain() { return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}; }
      createOscillator() { return {frequency:{setValueAtTime(){}},connect(){},start(){},stop(){}}; }
      close() { return Promise.resolve(); }
    }
    class ProbeNotification {
      static permission = 'granted';
      constructor() { window.reminderProbe.notifications++; }
    }
    window.AudioContext = ProbeAudio;
    window.Notification = ProbeNotification;
  });
  try {
    await Promise.all([setup(page),setup(second)]);
    const event = {id:`synthetic-reminder-${Date.now()}`,source:'swp-call',taskType:'call',areaId:999999,timestampMs:1,description:'合成测试',locationLabel:'测试病区'};
    const send = (tab, event) => tab.evaluate(async event => {
      const service = await import('/src/services/swp-call-notifier.ts');
      service.setSwpCallAlertsEnabled(true);
      return service.notifyNewSwpCalls([event]);
    }, event);
    await Promise.all([send(page,event),send(second,event)]);
    const counts = await Promise.all([page.evaluate(() => window.reminderProbe),second.evaluate(() => window.reminderProbe)]);
    assert(counts.reduce((n,item) => n+item.sounds,0) === 1, 'cross-tab sound duplicated');
    assert(counts.reduce((n,item) => n+item.notifications,0) === 1, 'cross-tab notification duplicated');
    await page.evaluate(() => { window.reminderProbe.sounds=0; window.reminderProbe.notifications=0; window.reminderProbe.failSound=true; });
    const retry = {...event,id:`${event.id}-retry`};
    await send(page,retry);
    await page.evaluate(() => { window.reminderProbe.failSound=false; });
    await send(page,retry);
    const recovered = await page.evaluate(() => window.reminderProbe);
    assert(recovered.sounds === 2 && recovered.notifications === 1, 'retry duplicated successful channel or skipped failed sound');
    await page.evaluate(async () => {
      const service = await import('/src/services/swp-call-notifier.ts');
      service.resetSwpCallNotifier();
      await service.retryFailedCallReminders();
    });
    const afterReset = await page.evaluate(() => window.reminderProbe);
    assert(afterReset.sounds === 2 && afterReset.notifications === 1, 'old scope retried after reset');
    return {passed:true,crossTab:counts,recovered,actualAudioAndDesktopDelivery:'stubbed; requires site acceptance'};
  }
  finally {
    await page.evaluate(async () => (await import('/src/services/swp-call-notifier.ts')).disableSwpCallAlerts());
    await second.close();
    await page.reload();
  }
}
