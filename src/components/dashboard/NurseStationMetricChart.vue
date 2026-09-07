<script setup lang="ts">
import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

interface NurseStationKpi {
  key: string;
  label: string;
  value: number | string;
  unit: string;
  tone: string;
}

const props = defineProps<{
  kpis: NurseStationKpi[];
}>();

const chartElement = ref<HTMLDivElement>();
const hasNumericData = computed(() =>
  props.kpis.some(item => typeof item.value === "number" && Number.isFinite(item.value)),
);
let chart: echarts.ECharts | undefined;
let resizeObserver: ResizeObserver | undefined;

const toneColors: Record<string, string> = {
  cyan: "#68e5ff",
  blue: "#7aa8ff",
  green: "#9df4bf",
  alert: "#ff86b3",
  infusion: "#8de7ff",
  warn: "#ffd080",
};
const scaleByKey: Record<string, number> = {
  occupied: 30,
  empty: 30,
  calls: 20,
  vital: 20,
  infusing: 20,
  online: 20,
};

function renderChart() {
  if (!chart || !hasNumericData.value) {
    chart?.clear();
    return;
  }
  const data = props.kpis
    .filter(item => typeof item.value === "number" && Number.isFinite(item.value))
    .map(item => ({
      name: item.label,
      value: Math.min(
        100,
        ((item.value as number) / (scaleByKey[item.key] ?? Math.max(item.value as number, 1))) * 100,
      ),
      rawValue: item.value as number,
      unit: item.unit,
      itemStyle: { color: toneColors[item.tone] ?? "#68e5ff" },
    }));
  chart.setOption({
    animationDuration: 650,
    animationEasing: "cubicOut",
    textStyle: { fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif' },
    grid: { left: 112, right: 52, top: 12, bottom: 18 },
    tooltip: {
      trigger: "item",
      confine: true,
      backgroundColor: "rgba(5, 20, 34, 0.94)",
      borderColor: "rgba(104, 229, 255, 0.42)",
      textStyle: { color: "#e9fbff" },
      formatter: (params: { data: { name: string; rawValue: number; unit: string } }) => {
        const item = params.data;
        return `${item.name}：${item.rawValue}${item.unit}`;
      },
    },
    xAxis: {
      type: "value",
      max: 100,
      min: 0,
      splitNumber: 5,
      axisLabel: {
        show: false,
        color: "rgba(190, 225, 238, 0.58)",
        fontSize: 9,
        formatter: "{value}%",
      },
      splitLine: { lineStyle: { color: "rgba(104, 229, 255, 0.1)" } },
      axisLine: { lineStyle: { color: "rgba(104, 229, 255, 0.2)" } },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: data.map(item => item.name),
      axisLabel: {
        color: "#d8f5fa",
        fontSize: 14,
        fontWeight: "bold",
      },
      axisLine: { lineStyle: { color: "rgba(104, 229, 255, 0.18)" } },
      axisTick: { show: false },
    },
    series: [{
      type: "bar",
      barMaxWidth: 14,
      barCategoryGap: "32%",
      showBackground: true,
      backgroundStyle: { color: "rgba(104, 229, 255, 0.08)", borderRadius: 8 },
      label: {
        show: true,
        position: "right",
        color: "#f1fdff",
        fontSize: 14,
        fontWeight: "bold",
        formatter: (params: { value: number; dataIndex: number }) =>
          `${data[params.dataIndex]?.rawValue ?? params.value}${data[params.dataIndex]?.unit ?? ""}`,
      },
      data,
      itemStyle: { borderRadius: [0, 8, 8, 0] },
    }],
  }, true);
}

onMounted(async () => {
  await nextTick();
  if (!chartElement.value) return;
  chart = echarts.init(chartElement.value, undefined, { renderer: "canvas" });
  resizeObserver = new ResizeObserver(() => chart?.resize());
  resizeObserver.observe(chartElement.value);
  renderChart();
});

watch(() => props.kpis, renderChart, { deep: true });

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  chart?.dispose();
  chart = undefined;
});
</script>

<template>
  <section class="nurse-metric-chart" aria-label="病区指标图表">
    <header class="nurse-metric-chart__head">
      <div>
        <span class="nurse-metric-chart__eyebrow">实时指标分析</span>
        <strong>病区运行指标</strong>
      </div>
      <span class="nurse-metric-chart__status">
        <i aria-hidden="true" />实时数据
      </span>
    </header>
    <div v-if="hasNumericData" ref="chartElement" class="nurse-metric-chart__canvas" />
    <div v-else class="nurse-metric-chart__empty">暂无可用指标</div>
  </section>
</template>

<style scoped lang="scss">
.nurse-metric-chart {
  min-height: 200px;
  padding: 12px 14px 10px;
  border: 1px solid rgba(104, 229, 255, 0.2);
  border-radius: 12px;
  background:
    radial-gradient(circle at 90% 0, rgba(87, 226, 255, 0.12), transparent 38%),
    linear-gradient(145deg, rgba(13, 46, 65, 0.78), rgba(5, 20, 35, 0.7));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  &__eyebrow,
  &__status {
    display: block;
    color: rgba(174, 220, 235, 0.64);
    font-size: 10px;
  }

  &__head strong {
    display: block;
    margin-top: 3px;
    color: #e8fbff;
    font-size: 14px;
  }

  &__status {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: #9df4bf;
  }

  &__status i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #9df4bf;
    box-shadow: 0 0 8px rgba(157, 244, 191, 0.9);
  }

  &__canvas {
    width: 100%;
    height: 140px;
    margin-top: 6px;
  }

  &__empty {
    display: grid;
    min-height: 140px;
    place-items: center;
    color: rgba(190, 225, 238, 0.62);
    font-size: 12px;
  }
}
</style>
