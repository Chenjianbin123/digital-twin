<script setup lang="ts">
import { useId } from 'vue';
const glowId = `command-frame-${useId()}`;
</script>

<template>
  <svg class="command-frame" viewBox="0 0 1000 1600" preserveAspectRatio="none" fill="none" aria-hidden="true">
    <defs><linearGradient :id="glowId" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#004779"/><stop offset=".5" stop-color="#00c9f4"/><stop offset="1" stop-color="#0073ae"/></linearGradient></defs>
    <path d="M62 4H940L994 58V1538L942 1594H58L6 1542V62Z" fill="#f8fcff" fill-opacity=".94" stroke="#99d9f5" />
    <path d="M70 16H923L978 70V1530L928 1580H88L28 1520V634L52 612V50Z" stroke="#0076b7" stroke-width="1.4"/>
    <path d="M88 34H913L960 80V1517L916 1560H105L48 1503V651M70 598V67L99 38" stroke="#80ceee"/>
    <path d="M944 18H966L980 32V64ZM23 1525L76 1578H41L23 1560Z" :fill="`url(#${glowId})`" />
    <path d="M52 153V286L62 275V165ZM978 322V448L968 460V334ZM978 1360V1468L967 1480V1372Z" :fill="`url(#${glowId})`" />
    <path d="M24 110H34M24 306H34M24 351H34M24 432H34M24 565H34M80 84V60L106 34M148 1575H180L194 1562M806 1562L820 1575H852" stroke="#00a4db" stroke-width="3" />
    <path d="M24 704V1335M974 520V1280" stroke="#4bbce4" stroke-width="2" />
    <path d="M218 1575h58m448 0h58" stroke="#22b4df" stroke-width="2" stroke-dasharray="4 5" />
  </svg>
</template>

<style scoped>
.command-frame { display: none; }
path { vector-effect: non-scaling-stroke; }
</style>
