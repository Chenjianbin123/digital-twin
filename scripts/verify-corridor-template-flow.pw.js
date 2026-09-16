async page => {
  await page.route('**/__corridor-audit__', route => route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0"><div id="scene" style="width:100vw;height:100vh"></div></body></html>' }));
  await page.route('**/querySwpTemplateInfoById', route => route.fulfill({ json: { code: 200, data: { id: 3, analyzeType: '1', templateContent: JSON.stringify({ isNew: true, width: 1080, height: 1920, background: '#e4f4f4', data: [{ type: 'element', text: '模板已加载', left: 40, top: 400, width: 1000, height: 300, fontSize: 2, color: '#123c50' }] }) } } }));
  await page.goto('http://localhost:5173/__corridor-audit__');
  await page.evaluate(async () => {
    const { AreaScene } = await import('/src/core/area-scene.ts');
    const { normalizeDoorDevice } = await import('/src/api/normalize-door.ts');
    const { mapDoorListToTwinArea } = await import('/src/types/twin.ts');
    window.auditArea = mapDoorListToTwinArea([1, 2].map(id => normalizeDoorDevice({
      doorDeviceInfo: { sickroomCode: '', sickroomId: String(id), sickroomName: '测试' + id + '房', deviceCode: 'AUDIT-' + id, templateId: 3, director: '1', areaName: '验证病区' }, bedDeviceList: []
    })));
    window.auditScene = new AreaScene({ container: document.getElementById('scene'), modelKind: 'corridor', areaId: 1, onCorridorState: state => { window.auditState = state; } });
    window.auditScene.updateArea({ ...window.auditArea, rooms: [] });
  });
  await page.waitForFunction(() => window.auditState === 'ready', null, { timeout: 60000 });
  const initial = await page.evaluate(() => window.auditScene.wardCorridorBindings.map(b => b.screen.uuid));
  await page.evaluate(() => window.auditScene.updateArea(window.auditArea));
  const data = await page.evaluate(() => ({
    receivedRooms: window.auditScene.area.rooms.length,
    boundRooms: window.auditScene.wardCorridorBindings.filter(b => b.slot.roomIndex !== null).length,
    issues: window.auditScene.corridorLayout.resolve(window.auditArea.rooms).issues
  }));
  if (data.boundRooms !== 2) throw Error(JSON.stringify(data));
  await page.waitForFunction(() => window.auditScene.wardCorridorBindings.filter(b => b.screenReady).length === 2, null, { timeout: 30000 });
  for (const action of ['refresh', 'reverse', 'hide-return']) {
    await page.evaluate(action => {
      if (action === 'reverse') window.auditArea.rooms.reverse();
      if (action === 'hide-return') { window.auditScene.setActive(false); window.auditScene.setActive(true); }
      else window.auditScene.updateArea(window.auditArea);
    }, action);
    await page.waitForFunction(() => window.auditScene.wardCorridorBindings.filter(b => b.screenReady).length === 2, null, { timeout: 30000 });
    const ids = await page.evaluate(() => window.auditScene.wardCorridorBindings.map(b => b.screen.uuid));
    if (JSON.stringify(ids) !== JSON.stringify(initial)) throw Error('original screen lost');
  }
  await page.evaluate(() => {
    const s = window.auditScene;
    const screen = s.wardCorridorBindings.find(b => b.screenReady).screen;
    screen.geometry.computeBoundingBox();
    const target = screen.geometry.boundingBox.clone().applyMatrix4(screen.matrixWorld).getCenter(s.camera.position.clone());
    const axis = s.wardCorridorBoundMeshes.widthAxis;
    s.setActive(false);
    s.camera.position.copy(target);
    s.camera.position[axis] += target[axis] > 0 ? -2 : 2;
    s.camera.lookAt(target);
    s.camera.updateMatrixWorld();
    s.renderer.render(s.scene, s.camera);
  });
  await page.screenshot({ path: 'output/playwright/corridor-template-full.jpg' });
  const result = await page.evaluate(() => ({
    rooms: window.auditScene.area.rooms.length,
    ready: window.auditScene.wardCorridorBindings.filter(b => b.screenReady).length,
    originalScreens: window.auditScene.wardCorridorBindings.every(b => !b.screen.userData.generatedHospitalCorridorOverlay)
  }));
  await page.evaluate(() => window.auditScene.dispose());
  return result;
}
