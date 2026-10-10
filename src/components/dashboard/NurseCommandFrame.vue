<template>
  <div class="command-frame" aria-hidden="true">
    <i class="command-frame__rail command-frame__rail--outer" />
    <i class="command-frame__rail command-frame__rail--inner" />
    <i class="command-frame__corner command-frame__corner--top" />
    <i class="command-frame__corner command-frame__corner--bottom" />
    <i class="command-frame__ticks command-frame__ticks--left" />
    <i class="command-frame__ticks command-frame__ticks--right" />
    <i class="command-frame__footer" />
  </div>
</template>

<style scoped>
/* Fixed-size cuts prevent the frame stretching on tall and narrow panels. */
.command-frame {
  --frame-cut: 24px;
  display: none; pointer-events: none;
  background: var(--frame-line); clip-path: var(--frame-shape);
}
.command-frame, .command-frame__rail {
  --frame-shape: polygon(var(--frame-cut) 0, calc(100% - var(--frame-cut)) 0, 100% var(--frame-cut), 100% calc(100% - var(--frame-cut)), calc(100% - var(--frame-cut)) 100%, var(--frame-cut) 100%, 0 calc(100% - var(--frame-cut)), 0 var(--frame-cut));
}
.command-frame::before, .command-frame__rail::before {
  content: ''; position: absolute; inset: 1px;
  background: var(--frame-paper); clip-path: var(--frame-shape);
}
.command-frame__rail { position: absolute; clip-path: var(--frame-shape); }
.command-frame__rail--outer { inset: 6px; --frame-cut: 21px; background: var(--frame-accent); }
.command-frame__rail--inner { inset: 12px; --frame-cut: 18px; background: var(--frame-line); }
.command-frame__corner { position: absolute; width: 26px; height: 26px; background: var(--frame-accent); }
.command-frame__corner--top { top: 7px; right: 7px; clip-path: polygon(0 0, 45% 0, 100% 55%, 100% 100%); }
.command-frame__corner--bottom { bottom: 7px; left: 7px; clip-path: polygon(0 0, 100% 100%, 55% 100%, 0 45%); }
.command-frame__ticks { position: absolute; top: 70px; bottom: 60px; width: 4px; background: repeating-linear-gradient(to bottom,var(--frame-accent) 0 4px,transparent 4px 96px); }
.command-frame__ticks--left { left: 3px; }
.command-frame__ticks--right { right: 3px; top: 124px; }
.command-frame__footer { position: absolute; bottom: 6px; left: 22%; right: 22%; height: 3px; background: repeating-linear-gradient(90deg,var(--frame-accent) 0 4px,transparent 4px 9px); }
@media (max-width: 1023px) {
  .command-frame { --frame-cut: 16px; }
  .command-frame__rail--outer { inset: 4px; --frame-cut: 13px; }
  .command-frame__rail--inner { inset: 8px; --frame-cut: 10px; }
  .command-frame__corner { width: 16px; height: 16px; }
  .command-frame__ticks { width: 2px; }
  .command-frame__footer { bottom: 4px; }
}
</style>
