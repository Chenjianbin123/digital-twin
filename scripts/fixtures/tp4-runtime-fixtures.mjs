export function makeTP4(device = 'bed', portrait = false) {
  const width = portrait ? 480 : 800;
  const height = portrait ? 800 : 480;
  const region = (id, widget, x, y, w, h) => ({
    id, grid: { col: 0, row: 0, colSpan: 12, rowSpan: 1 },
    editor: { bounds: { x, y, w, h } }, widget: { id, ...widget },
  });
  const text = (path, size = 32, color = '#ffffff') => ({
    kind: 'primitive.text', content: { source: 'dataSource', path },
    style: { fontSize: size, color, alignItems: 'center', padding: '8px' },
  });
  const regions = [
    region('title', { kind: 'primitive.text', content: { source: 'static', static: device === 'bed' ? '床头屏 · TP4' : '病房门口屏 · TP4' }, style: { fontSize: 28, color: '#90caf9' } }, 28, 20, width - 56, 52),
    region('identity', text(device === 'bed' ? 'bedDeviceInfoVo,bedName' : 'doorDeviceInfo,sickroomName', 40), 28, 88, width - 160, 70),
  ];
  if (device === 'bed') {
    regions.push(region('patient', text('bedSickInfoVo,sickName', 48), 28, 178, width - 56, 90));
    regions.push(region('qrcode', { kind: 'primitive.image', src: { source: 'dataSource', path: 'bedDeviceInfoVo,deviceCode' } }, width - 145, height - 135, 110, 110));
  } else {
    regions.push(region('beds', {
      kind: 'repeater.bedList', dataBinding: { sourceId: 'bedDeviceList' },
      templateRules: [{ id: 'all-beds', minBeds: 1, template: {
        id: 'row', kind: 'container.stack', style: { width: '100%', height: '80px', display: 'flex', background: '#17405e' },
        children: [
          { id: 'bed-code', ...text('bedDeviceList,bedName', 26), style: { width: '30%', fontSize: 26, color: '#ffffff' } },
          { id: 'bed-patient', ...text('bedDeviceList,sickInfo,sickName', 30), style: { width: '70%', fontSize: 30, color: '#ffffff' } },
        ],
      } }],
    }, 28, 180, width - 56, height - 260));
    regions.push(region('temp', text('doorEnvData,temp', 26), 28, height - 65, 180, 50));
  }
  return {
    schemaVersion: 4,
    meta: { id: 'synthetic-runtime', systemType: 'linux', templateType: device, frame: { width, height, unit: 'px' }, rootFontSize: 32, density: 'fixed' },
    theme: { colors: { canvas: '#102a43' } }, dataCatalog: [],
    pages: [{ id: 'main', key: 'main', name: '主页', role: 'standard', layout: { type: 'grid', cols: 12, rowHeight: 10, gap: 0, padding: [0, 0, 0, 0] }, regions }],
  };
}
export function makeLegacyV3() {
  return {
    width: 800, height: 480, background: '#102a43',
    data: [1, 2].map(index => ({
      index, pageName: `第${index}页`, componentList: [{
        id: `legacy-name-${index}`, componentName: 'HText',
        attr: { x: '32px', y: '100px', w: '700px', h: '120px' },
        extraProperty: { fontSize: 48, color: '#ffffff' },
        dataId: 'bedSickInfoVo', dataKey: 'bedSickInfoVo,sickName',
      }],
    })),
  };
}

export function makeBed(code = '01', name = '测试甲') {
  return {
    bedCode: code, bedName: `${code}床`, deviceCode: `synthetic-${code}`, isOccupied: true,
    isOnline: true, position: { x: 0, z: 0 },
    sickInfo: { bedCode: code, bedName: `${code}床`, sickName: name, sickNo: `synthetic-patient-${code}` },
  };
}
