export type HospitalOverview = 'exterior' | 'floor';
export type HospitalView = HospitalOverview | 'clinical';

export const hospitalModels = {
  exterior: { asset: '/models/hospital-navigation/hospital-exterior-v3.glb', metadata: '/models/hospital-navigation/exterior-3d.json', environment: '/models/hospital-navigation/hospital-daylight.exr', target: 'floor' },
  floor: { asset: '/models/hospital-navigation/hospital-floor-v4.glb', metadata: '/models/hospital-navigation/floor-3d.json', target: 'nurse-station' },
} as const;
