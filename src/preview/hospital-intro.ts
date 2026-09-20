import { createHospitalIntroScene, HOSPITAL_INTRO_DURATION, type HospitalIntroScene } from '../core/hospital-exterior/hospital-intro-scene';

declare global { interface Window { showIntroLogin: (message: string) => void } }
const host = document.querySelector<HTMLDivElement>('#scene')!;
const intro = document.querySelector<HTMLElement>('#intro')!;
const login = document.querySelector<HTMLElement>('#login')!;
const pause = document.querySelector<HTMLButtonElement>('#pause')!;
const skip = document.querySelector<HTMLButtonElement>('#skip')!;
const replay = document.querySelector<HTMLButtonElement>('#replay')!;
const shot = document.querySelector<HTMLElement>('#shot')!;
const progress = document.querySelector<HTMLElement>('#progress')!;
const time = document.querySelector<HTMLElement>('#time')!;
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let scene: HospitalIntroScene | undefined;
let paused = false;
let closed = intro.hidden;

function finish(message: string) {
  if (closed) return;
  closed = true;
  scene?.setPaused(true);
  window.showIntroLogin(message);
}
function start() {
  scene?.dispose(); scene = undefined;
  closed = false; paused = false; pause.textContent = '暂停';
  login.hidden = true; intro.hidden = false; document.body.classList.remove('finished');
  if (motion.matches) { finish('已按系统减少动态效果设置跳过动画。'); return; }
  try {
    const created = createHospitalIntroScene(host, {
      onProgress(seconds) {
        progress.style.width = `${seconds / HOSPITAL_INTRO_DURATION * 100}%`;
        time.textContent = `${String(Math.floor(seconds)).padStart(2, '0')} / 08`;
        const label = seconds < 2.8 ? '01 / 医院全景' : seconds < 5.8 ? '02 / 掠过建筑立面' : '03 / 抵达主入口';
        if (shot.textContent !== label) shot.textContent = label;
      },
      onComplete() { finish('开场结束，进入登录。'); },
      onError() { finish('三维预览暂不可用，可直接前往登录。'); },
    });
    if (closed) created.dispose(); else scene = created;
  } catch { finish('三维预览暂不可用，可直接前往登录。'); }
}
function motionChanged() { if (motion.matches) finish('已按系统减少动态效果设置跳过动画。'); }
pause.onclick = () => { paused = !paused; pause.textContent = paused ? '继续' : '暂停'; scene?.setPaused(paused); };
skip.onclick = () => finish('已跳过动画，进入登录。');
replay.onclick = () => { start(); if (!closed) skip.focus(); };
motion.addEventListener('change', motionChanged);
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  scene?.dispose();
  motion.removeEventListener('change', motionChanged);
});
if (!closed) start();
