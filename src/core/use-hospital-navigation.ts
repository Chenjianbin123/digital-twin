import { computed, ref, watch, type Ref } from 'vue';
import type { TwinSceneType } from '../types/twin.ts';
import type { HospitalView } from './hospital-navigation.ts';

/** Campus navigation wraps clinical navigation without changing patient/room routing. */
export function useHospitalNavigation(scene: Readonly<Ref<TwinSceneType>>) {
  const view = ref<HospitalView>('exterior');
  const floorVisited = ref(false);
  const clinicalVisited = ref(false);
  const clinicalActive = computed(() => view.value === 'clinical');

  function openFloor() { floorVisited.value = true; view.value = 'floor'; }
  function openClinical() {
    floorVisited.value = true;
    clinicalVisited.value = true;
    view.value = 'clinical';
  }
  // Existing alert, assistant and room links still land in their clinical scene.
  watch(scene, openClinical, { flush: 'sync' });
  return { view, floorVisited, clinicalVisited, clinicalActive, openFloor, openClinical,
    openExterior: () => { view.value = 'exterior'; } };
}
