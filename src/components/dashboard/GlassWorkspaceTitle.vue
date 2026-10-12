<script setup lang="ts">
import { useId } from 'vue';
defineProps<{ title: string; kicker: string }>();
const titleId = useId();
</script>

<template>
    <header class="station-hero station-hero--glass">
      <svg class="station-glass-frame" viewBox="0 0 600 125" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient :id="`${titleId}-glass-rim`" x2="0" y2="1">
            <stop stop-color="var(--glass-rim-light)" /><stop offset=".22" stop-color="var(--glass-rim-mid)" /><stop offset=".7" stop-color="var(--glass-rim-dark)" /><stop offset="1" stop-color="var(--glass-rim-light)" />
          </linearGradient>
        </defs>
        <path d="M18 3H582L597 18V107L582 122H18L3 107V18Z" fill="none" :stroke="`url(#${titleId}-glass-rim)`" stroke-width="1.2" vector-effect="non-scaling-stroke" />
        <path d="M20 8H580L592 20V105L580 117H20L8 105V20Z" fill="none" stroke="var(--glass-edge)" stroke-opacity=".35" stroke-width=".7" vector-effect="non-scaling-stroke" />
        <path d="M10 47H37L66 77H90M590 47H563L534 77H510M10 55H33L62 85H86M590 55H567L538 85H514" fill="none" stroke="var(--glass-circuit)" stroke-width=".7" />
        <circle cx="90" cy="77" r="1.6" fill="var(--glass-edge)" /><circle cx="510" cy="77" r="1.6" fill="var(--glass-edge)" />
      </svg>
      <span class="station-glass-light" aria-hidden="true" />
      <div class="station-hero__overview-head">
        <div class="station-hero__identity">
          <svg class="station-glass-plate" viewBox="0 0 500 100" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient :id="`${titleId}-glass-plate`" x2="0" y2="1"><stop stop-color="var(--glass-plate-top)" /><stop offset="1" stop-color="var(--glass-plate)" /></linearGradient></defs>
            <path d="M2 2H498L462 98H38Z" :fill="`url(#${titleId}-glass-plate)`" stroke="var(--glass-plate-line)" stroke-width=".8" vector-effect="non-scaling-stroke" />
            <path d="M4 3H496M39 97H461" fill="none" stroke="var(--glass-edge)" stroke-opacity=".55" stroke-width="1" vector-effect="non-scaling-stroke" />
          </svg>
          <svg class="station-glass-emblem" viewBox="0 0 60 68" aria-hidden="true">
            <defs><linearGradient :id="`${titleId}-medical-glass`" x2=".8" y2="1"><stop stop-color="#c4f5ff" /><stop offset=".4" stop-color="#4dbce7" /><stop offset="1" stop-color="#126991" /></linearGradient></defs>
            <path d="M30 5 56 20V49L30 65 4 49V20Z" fill="#176b96" stroke="#71d4ee" />
            <path d="M30 2 56 17V46L30 62 4 46V17Z" :fill="`url(#${titleId}-medical-glass)`" stroke="#c4f6ff" />
            <path d="M30 7 51 20V43L30 56 9 43V20Z" fill="#7cdfff" fill-opacity=".17" stroke="#c1f3ff" stroke-opacity=".8" />
            <path d="M25 17h10v10h10v10H35v10H25V37H15V27h10Z" fill="#eafaff" stroke="#fff" stroke-width=".6" />
            <path d="m7 19 23-14 22 13M7 45l23 14 23-14" fill="none" stroke="#e1faff" stroke-opacity=".8" />
          </svg>
          <div class="station-hero__wordmark">
            <span class="station-hero__kicker" aria-hidden="true">{{ kicker }}</span>
            <span class="station-hero__eyebrow">{{ title }}</span>
          </div>
        </div>
      </div>
    </header>
</template>

<style lang="scss" src="../../styles/nurse-station-glass-title.scss"></style>

