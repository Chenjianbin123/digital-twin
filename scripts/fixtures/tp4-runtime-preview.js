import * as THREE from 'three';
import { makeTP4, makeBed, makeLegacyV3 } from './tp4-runtime-fixtures.mjs';
import legacyBed from '/src/mock/bed-template-default.json';
import legacyDoor from '/src/mock/door-template-default.json';
import legacyDoorMain from '/src/mock/door-template-main.json';
import { parseTemplateInfo } from '/src/core/template/parser.ts';
import { renderBedTerminalTexture } from '/src/core/template/bed-terminal-texture.ts';
import { renderDoorTerminalTexture } from '/src/core/template/door-terminal-texture.ts';
import { setFileUrlPrefix } from '/src/utils/file-prefix.ts';

setFileUrlPrefix('');
const parse = document => parseTemplateInfo({ id: 9001, templateContent: JSON.stringify(document) });
const check = (value, message) => { if (!value) throw new Error(message); };
const captures = [];
let peakHosts = 0;
const observer = new MutationObserver(() => {
  const hosts = [...document.querySelectorAll('[data-template-runtime-host]')];
  peakHosts = Math.max(peakHosts, hosts.length);
  for (const host of hosts) captures.push({
    text: host.textContent,
    qr: !!host.querySelector('.swp-tp4-qrcode svg'),
    beds: host.querySelectorAll('.swp-tp4-bed-list__item').length,
    empty: host.querySelectorAll('.swp-tp4-bed-list__item--empty').length,
  });
});
observer.observe(document.body, { childList: true, subtree: true });
const ResizeObserverClass = window.ResizeObserver;
const liveObservers = new Set();
window.ResizeObserver = class extends ResizeObserverClass {
  observe(...args) { liveObservers.add(this); return super.observe(...args); }
  disconnect() { liveObservers.delete(this); return super.disconnect(); }
};
const pixels = canvas => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
function add(title, canvas) {
  const section = document.createElement('section');
  const heading = document.createElement('h2'); heading.textContent = title;
  section.append(heading, canvas); document.querySelector('#previews').append(section);
}
function assertVisible(canvas) {
  const data = pixels(canvas); let visible = 0; let changed = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) visible++;
    if (data[i] !== data[0] || data[i + 1] !== data[1] || data[i + 2] !== data[2]) changed++;
  }
  check(visible > canvas.width * canvas.height * .9, '纹理透明或空白');
  check(changed > canvas.width * canvas.height * .005, '纹理只有背景色');
}
async function run() {
  const textures = [];
  try {
    const bedDocument = makeTP4();
    const bed = makeBed('01', '合成甲');
    const first = await renderBedTerminalTexture(bed, parse(bedDocument), {}); textures.push(first);
    assertVisible(first.image); add('床头屏 · 患者与二维码', first.image);
    check(captures.some(c => c.text.includes('合成甲') && c.qr), '患者或二维码未渲染');
    const second = await renderBedTerminalTexture(makeBed('01', '合成乙'), parse(bedDocument), {}); textures.push(second);
    check(second.image.toDataURL() !== first.image.toDataURL(), '患者更新未改变纹理');
    add('床头屏 · 同床患者数据更新', second.image);
    const empty = await renderBedTerminalTexture({ ...bed, isOccupied: false }, parse(bedDocument), {}); textures.push(empty);
    assertVisible(empty.image); add('床头屏 · 清空旧患者后的空床', empty.image);
    check(captures.some(c => c.text.includes('空床') && !c.text.includes('合成甲')), '空床残留旧患者');
    const room = { sickroomName: '合成 101 病房', sickroomCode: 'room-101', sickroomId: '101', deviceCode: 'door-101', director: '1',
      doorEnvData: { temp: '23', relativeHumid: '50' },
      beds: [makeBed('01', '合成甲'), { ...makeBed('02', '旧患者'), isOccupied: false }, makeBed('03', '合成丙')],
    };
    const door = await renderDoorTerminalTexture(room, {}, parse(makeTP4('door', true))); textures.push(door);
    assertVisible(door.image); add('门口竖屏 · 三张实体床含空床', door.image);
    check(door.image.height > door.image.width, '竖屏比例错误');
    check(captures.some(c => c.beds === 3 && c.empty === 1 && !c.text.includes('旧患者')), '门口床位作用域或空床错误');
    for (const [name, input, device] of [
      ['存量床头模板', legacyBed, 'bed'], ['存量门口竖屏模板', legacyDoor, 'door'],
      ['存量门口横屏模板', legacyDoorMain, 'door'],
      ['V3 多页模板', { templateContent: JSON.stringify(makeLegacyV3()) }, 'bed'],
    ]) {
      const migrated = parseTemplateInfo({ id: 9002, templateContent: input.templateContent, systemType: 'android', templateType: device });
      check(migrated.document?.schemaVersion === 4, `${name}未经过运行库迁移`);
      const captureStart = captures.length;
      const texture = device === 'bed'
        ? await renderBedTerminalTexture(bed, migrated, {})
        : await renderDoorTerminalTexture({ ...room, director: input === legacyDoorMain ? '0' : '1' }, {}, migrated);
      textures.push(texture); assertVisible(texture.image); add(`${name} · npm 迁移`, texture.image);
      if (device === 'bed') check(captures.slice(captureStart).some(c => c.text.includes('合成甲')), `${name}患者绑定丢失`);
      else {
        check(captures.slice(captureStart).some(c => c.text.includes('合成 101 病房')), `${name}房间绑定丢失`);
        if (input === legacyDoorMain) check(captures.slice(captureStart).some(c => c.beds === 3), `${name}实体床位丢失`);
      }
    }
    const imageDoc = makeTP4();
    imageDoc.pages[0].regions.push({ id: 'test-image', grid: { col: 0, row: 0, colSpan: 1, rowSpan: 1 }, editor: { bounds: { x: 400, y: 95, w: 100, h: 60 } },
      widget: { id: 'test-image', kind: 'primitive.image', src: { source: 'static', static: '/scripts/fixtures/tp4-runtime-image.svg?version=1' } } });
    const imageTexture = await renderBedTerminalTexture(bed, parse(imageDoc), {}); textures.push(imageTexture);
    assertVisible(imageTexture.image);
    const badDoc = structuredClone(imageDoc); badDoc.pages[0].regions.at(-1).widget.src.static = '/scripts/fixtures/tp4-missing-image.svg';
    let failed = false;
    try { await renderBedTerminalTexture(bed, parse(badDoc), {}); } catch { failed = true; }
    check(failed, '缺失图片被静默丢弃');
    const unknown = makeTP4(); unknown.pages[0].regions[0].widget.kind = 'unsupported.component';
    try { await renderBedTerminalTexture(bed, parse(unknown), {}); throw new Error('未支持组件没有报错'); }
    catch (error) { check(error.message.includes('未支持'), '组件错误未明确返回'); }
    const batch = await Promise.all(Array.from({ length: 5 }, (_, i) => renderBedTerminalTexture(makeBed(`${i + 10}`, `并发${i}`), parse(makeTP4()), {})));
    textures.push(...batch);
    const nativeFetch = window.fetch;
    const nativeTimeout = window.setTimeout;
    const nativeInterval = window.setInterval;
    try {
      let intervals = 0;
      window.setInterval = (...args) => { intervals++; return nativeInterval(...args); };
      window.fetch = async (...args) => {
        if (String(args[0]).includes('slow-swiper')) await new Promise(resolve => nativeTimeout(resolve, 120));
        return nativeFetch(...args);
      };
      const swiperDoc = structuredClone(imageDoc);
      swiperDoc.pages[0].regions.at(-1).widget.src.static += '&slow-swiper=1';
      swiperDoc.pages[0].regions.push({ id: 'slides', grid: { col: 0, row: 0, colSpan: 1, rowSpan: 1 }, editor: { bounds: { x: 40, y: 320, w: 120, h: 80 } },
        widget: { id: 'slides', kind: 'container.swiper', initialSlide: 1, autoplayMs: 10, children: [
          { id: 'red', kind: 'primitive.rect', style: { background: '#ff0000' } },
          { id: 'green', kind: 'primitive.rect', style: { background: '#00ff00' } },
        ] } });
      const frozen = await renderBedTerminalTexture(bed, parse(swiperDoc), {}); textures.push(frozen);
      const green = frozen.image.getContext('2d').getImageData(50, 230, 1, 1).data;
      check(intervals === 0 && green[1] > 240 && green[0] < 10, '慢图片导致轮播偏离 initialSlide');
      // 缩短本次测试的 15 秒期限；模拟二十个永不返回的图片内嵌请求。
      window.setTimeout = (callback, delay, ...args) => nativeTimeout(callback, delay === 15000 ? 200 : delay, ...args);
      window.fetch = (...args) => String(args[0]).includes('queue-slow')
        ? new Promise((_, reject) => args[1].signal.addEventListener('abort', () => reject(args[1].signal.reason), { once: true }))
        : nativeFetch(...args);
      const slowDoc = structuredClone(imageDoc);
      slowDoc.pages[0].regions.at(-1).widget.src.static += '&queue-slow=1';
      const started = performance.now();
      const results = await Promise.allSettled(Array.from({ length: 20 }, () => renderBedTerminalTexture(bed, parse(slowDoc), {})));
      check(results.every(result => result.status === 'rejected'), '慢任务没有进入超时失败路径');
      check(performance.now() - started < 600, '排队时间未计入总超时，旧任务持续阻塞队列');
    } finally {
      window.fetch = nativeFetch; window.setTimeout = nativeTimeout; window.setInterval = nativeInterval;
    }
    const recovered = await renderBedTerminalTexture(bed, parse(makeTP4()), {}); textures.push(recovered);
    assertVisible(recovered.image);
    check(peakHosts <= 2, '超出并发上限');
    check(!document.querySelector('[data-template-runtime-host]'), '隐藏渲染 DOM 未回收');
    check(liveObservers.size === 0, 'ResizeObserver 未回收');
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(512, 320); renderer.setClearColor('#eef3f8');
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-.8, .8, .5, -.5, .1, 10); camera.position.z = 2;
    const geometry = new THREE.PlaneGeometry(1.6, .96);
    const material = new THREE.MeshBasicMaterial({ map: first }); scene.add(new THREE.Mesh(geometry, material));
    renderer.render(scene, camera); add('Three.js 实际材质贴图', renderer.domElement);
    const gl = renderer.getContext(); const glPixels = new Uint8Array(4);
    gl.readPixels(256, 160, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, glPixels);
    check(glPixels[3] > 0 && gl.getError() === gl.NO_ERROR, 'WebGL 纹理上传失败');
    geometry.dispose(); material.dispose(); renderer.dispose();
    return { passed: true, checks: ['TP4解析', '三份存量模板迁移与数据绑定', 'V3多页迁移与患者绑定', '患者更新', '空床清理', '门口多床作用域', '横竖比例', '二维码', '同源图片', '失败回收', '并发上限', 'DOM和Observer回收', 'WebGL贴图', '慢图轮播冻结', '排队总超时', '超时后恢复'], peakHosts, snapshots: captures.length };
  } finally {
    observer.disconnect(); window.ResizeObserver = ResizeObserverClass;
    textures.forEach(texture => texture.dispose());
  }
}
window.tp4Result = run().then(result => {
  document.querySelector('#result').textContent = JSON.stringify(result, null, 2); return result;
}).catch(error => {
  document.querySelector('#result').textContent = error.stack; return { passed: false, error: error.stack, captures: captures.slice(-8) };
});
