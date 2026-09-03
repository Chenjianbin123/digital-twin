<script setup lang="ts">

import { computed, ref } from 'vue';
import StaffAvatar from '@/components/StaffAvatar.vue';
import { buildMainStaffList } from '@/core/door-staff';
import type { DoorDeptUser, DoorMainStaff } from '@/types/ward';

interface ManagedCareStaff {
  role: '主治医生' | '责任护士';
  roleKey: 'bedDoctor' | 'dutyNurse';
  name: string;
  pic?: string;
  synopsis?: string;
  placeholderLabel: '医' | '护';
}

interface OtherCareStaff {
  role: '主任医生' | '护士长';
  roleKey: 'deptDirector' | 'areaHeadNurse';
  name: string;
  placeholderLabel: '医' | '护';
}

function avatarRole(roleKey: string): 'doctor' | 'director' | 'nurse' | 'default' {
  if (roleKey === 'bedDoctor')
    return 'doctor';
  if (roleKey === 'deptDirector')
    return 'director';
  if (roleKey === 'areaHeadNurse' || roleKey === 'dutyNurse')
    return 'nurse';
  return 'default';
}

function isMeaningfulDuty(value: unknown) {
  if (typeof value !== 'string')
    return false;
  const text = value.trim();
  return !!text && !/^\d+$/.test(text);
}



const props = withDefaults(defineProps<{

  staff?: DoorMainStaff;

  deptUsers?: DoorDeptUser[];

  managedCareStaff?: ManagedCareStaff[];

  otherCareStaff?: OtherCareStaff[];

  /** 仅展示科主任 + 护士长 */

  primaryOnly?: boolean;

  /** 紧凑模式，用于病区卡片内嵌 */

  compact?: boolean;

  title?: string;

}>(), {

  primaryOnly: false,

  compact: false,

  title: '医护团队',

});



const mainStaff = computed(() =>

  buildMainStaffList(props.staff, { primaryOnly: props.primaryOnly }),

);



const primaryStaff = computed(() =>

  mainStaff.value.filter(item => item.roleKey === 'deptDirector' || item.roleKey === 'areaHeadNurse'),

);



const otherStaff = computed(() =>

  mainStaff.value.filter(item => item.roleKey === 'areaDirector'),

);

const hasManagedCareStaff = computed(() => !!props.managedCareStaff?.length);

const hasOtherCareStaff = computed(() => !!props.otherCareStaff?.length);

const primaryDisplayStaff = computed(() =>
  hasManagedCareStaff.value
    ? props.managedCareStaff ?? []
    : primaryStaff.value,
);

const otherDisplayStaff = computed(() =>
  hasOtherCareStaff.value
    ? []
    : hasManagedCareStaff.value ? mainStaff.value : otherStaff.value,
);

const otherCareDisplayStaff = computed(() =>
  props.otherCareStaff ?? [],
);

const normalizedDeptUsers = computed(() =>
  (props.deptUsers ?? []).map(user => ({
    ...user,
    userDuty: isMeaningfulDuty(user.userDuty) ? user.userDuty?.trim() : '',
  })),
);

const visibleDeptUsers = computed(() =>
  hasOtherCareStaff.value ? [] : normalizedDeptUsers.value,
);

const teamRosterCount = computed(() =>
  primaryDisplayStaff.value.length
  + otherCareDisplayStaff.value.length
  + otherDisplayStaff.value.length
  + visibleDeptUsers.value.length,
);

const staffIntroDialog = ref<ManagedCareStaff | null>(null);

function isManagedCareItem(item: unknown): item is ManagedCareStaff {
  return !!item
    && typeof item === 'object'
    && 'roleKey' in item
    && (item.roleKey === 'bedDoctor' || item.roleKey === 'dutyNurse');
}

function openStaffIntro(item: unknown) {
  if (isManagedCareItem(item))
    staffIntroDialog.value = item;
}

function closeStaffIntro() {
  staffIntroDialog.value = null;
}



function roleClass(roleKey: string) {

  if (roleKey === 'deptDirector')

    return 'staff-role-card--director';

  if (roleKey === 'areaHeadNurse')

    return 'staff-role-card--nurse';

  if (roleKey === 'bedDoctor')

    return 'staff-role-card--managed-doctor';

  if (roleKey === 'dutyNurse')

    return 'staff-role-card--managed-nurse';

  return 'staff-role-card--director-general';

}

</script>



<template>

  <section

    v-if="primaryDisplayStaff.length || otherCareDisplayStaff.length || otherDisplayStaff.length || visibleDeptUsers.length"

    class="door-staff-cards"

    :class="{ 'door-staff-cards--compact': compact }"

  >

    <div v-if="!compact" class="door-staff-cards__head">

      <h3 class="door-staff-cards__title">

        {{ title }}

      </h3>

      <span class="door-staff-cards__title-count">

        共 {{ teamRosterCount }} 人

      </span>

    </div>



    <div v-if="primaryDisplayStaff.length" class="door-staff-cards__primary">

      <button

        v-for="item in primaryDisplayStaff"

        :key="item.roleKey"

        class="staff-role-card"

        :class="[roleClass(item.roleKey), { 'managed-care-card': hasManagedCareStaff }]"

        type="button"

        @click="openStaffIntro(item)"

      >

        <div class="staff-role-card__avatar-wrap">
          <StaffAvatar
            :pic="item.pic"
            :name="item.name"
            :size="compact ? 'md' : 'lg'"
            :role="avatarRole(item.roleKey)"
            :placeholder-label="'placeholderLabel' in item ? item.placeholderLabel : ''"
          />
        </div>

        <span class="staff-role-card__badge">{{ item.role }}</span>

        <span class="staff-role-card__name">{{ item.name }}</span>

        <span v-if="hasManagedCareStaff" class="staff-role-card__hint">点击查看简介</span>

      </button>

    </div>



    <div
      v-if="(otherCareDisplayStaff.length || otherDisplayStaff.length || visibleDeptUsers.length) && !primaryOnly && (hasManagedCareStaff || hasOtherCareStaff) && !compact"
      class="door-staff-cards__subhead"
    >
      其他医护
    </div>



    <div v-if="otherCareDisplayStaff.length && !primaryOnly" class="door-staff-cards__other">

      <div

        v-for="item in otherCareDisplayStaff"

        :key="item.roleKey"

        class="staff-role-card staff-role-card--inline other-care-card"

        :class="roleClass(item.roleKey)"

      >

        <StaffAvatar
          :pic="''"
          :name="item.name"
          size="sm"
          :role="avatarRole(item.roleKey)"
          :placeholder-label="item.placeholderLabel"
        />

        <div class="staff-role-card__inline-info">

          <span class="staff-role-card__badge staff-role-card__badge--sm">{{ item.role }}</span>

          <span class="staff-role-card__name staff-role-card__name--sm">{{ item.name }}</span>

        </div>

      </div>

    </div>



    <div v-if="otherDisplayStaff.length && !primaryOnly" class="door-staff-cards__other">

      <div

        v-for="item in otherDisplayStaff"

        :key="item.roleKey"

        class="staff-role-card staff-role-card--inline"

        :class="roleClass(item.roleKey)"

      >

        <StaffAvatar
          :pic="item.pic"
          :name="item.name"
          size="sm"
          :role="avatarRole(item.roleKey)"
        />

        <div class="staff-role-card__inline-info">

          <span class="staff-role-card__badge staff-role-card__badge--sm">{{ item.role }}</span>

          <span class="staff-role-card__name staff-role-card__name--sm">{{ item.name }}</span>

        </div>

      </div>

    </div>



    <ul v-if="visibleDeptUsers.length && !compact" class="door-staff-cards__dept door-staff-cards__dept-grid">

      <li v-for="(user, i) in visibleDeptUsers" :key="i">

        <StaffAvatar
          :pic="user.userPic"
          :name="user.userRealname"
          size="sm"
        />

        <span class="dept-user__name">{{ user.userRealname }}</span>

        <span v-if="user.userDuty" class="dept-user__duty">{{ user.userDuty }}</span>

      </li>

    </ul>

    <Teleport to="body">
      <div
        v-if="staffIntroDialog"
        class="staff-intro-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="`${staffIntroDialog.role}简介`"
        @click.self="closeStaffIntro"
      >
        <section class="staff-intro-modal__card">
          <button class="staff-intro-modal__close" type="button" aria-label="关闭简介" @click="closeStaffIntro">
            ×
          </button>
          <div class="staff-intro-modal__halo" aria-hidden="true" />
          <div class="staff-intro-modal__profile">
            <StaffAvatar
              :pic="staffIntroDialog.pic"
              :name="staffIntroDialog.name"
              size="lg"
              :role="avatarRole(staffIntroDialog.roleKey)"
              :placeholder-label="staffIntroDialog.placeholderLabel"
            />
            <div>
              <span>{{ staffIntroDialog.role }}</span>
              <strong>{{ staffIntroDialog.name }}</strong>
            </div>
          </div>
          <div class="staff-intro-modal__body">
            <h4>简介</h4>
            <p>{{ staffIntroDialog.synopsis || '暂无简介' }}</p>
          </div>
        </section>
      </div>
    </Teleport>

  </section>

</template>



<style scoped lang="scss">

@keyframes staff-card-scan {
  0% {
    opacity: 0;
    transform: translateX(-115%);
  }

  30%,
  62% {
    opacity: 0.78;
  }

  100% {
    opacity: 0;
    transform: translateX(220%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .door-staff-cards::before,
  .staff-role-card::before,
  .staff-intro-modal__card,
  .staff-intro-modal__halo {
    animation: none;
  }
}

@keyframes staff-intro-card-in {
  0% {
    opacity: 0;
    transform: translate3d(0, 14px, 0) scale(0.96);
  }

  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

@keyframes staff-intro-halo {
  0%,
  100% {
    opacity: 0.48;
    transform: rotate(0deg) scale(1);
  }

  50% {
    opacity: 0.8;
    transform: rotate(12deg) scale(1.04);
  }
}

.door-staff-cards {

  position: relative;
  overflow: hidden;
  margin-bottom: 16px;

  padding: 15px 14px 14px;

  background:
    radial-gradient(circle at 16% 0%, rgba(82, 222, 255, 0.14), transparent 34%),
    radial-gradient(circle at 86% 20%, rgba(245, 143, 177, 0.11), transparent 32%),
    linear-gradient(145deg, rgba(8, 42, 64, 0.68), rgba(4, 18, 32, 0.46)),
    rgba(6, 20, 36, 0.3);

  border: 1px solid rgba(83, 222, 255, 0.24);

  border-radius: 12px;
  box-shadow:
    0 12px 26px rgba(0, 0, 0, 0.14),
    inset 0 1px 0 rgba(193, 247, 255, 0.1),
    inset 3px 0 0 rgba(77, 224, 255, 0.42);

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 44%;
    height: 1px;
    pointer-events: none;
    background: linear-gradient(90deg, rgba(135, 241, 255, 0.92), transparent);
    box-shadow: 0 0 16px rgba(77, 224, 255, 0.46);
    animation: staff-card-scan 7.2s ease-in-out infinite;
  }



  &--compact {

    margin-bottom: 8px;

    padding: 0;

    background: none;

  }



  &__title {

    margin: 0;

    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.1em;

    color: #c7f8ff;
    text-shadow: 0 0 12px rgba(77, 224, 255, 0.32);

  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
  }

  &__title-count {
    flex-shrink: 0;
    padding: 4px 9px;
    border: 1px solid rgba(83, 222, 255, 0.26);
    border-radius: 999px;
    color: #7eeeff;
    background: rgba(6, 29, 48, 0.62);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.06em;
    box-shadow: 0 0 14px rgba(77, 224, 255, 0.12);
  }



  &__primary {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;

    @include down($bp-xs) {
      grid-template-columns: 1fr;
    }
  }



  &--compact &__primary {

    gap: 8px;

  }



  &__other {

    margin-top: 12px;

    display: grid;

    grid-template-columns: repeat(2, minmax(0, 1fr));

    gap: 8px;

  }

  &__subhead {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 13px 0 8px;
    color: rgba(178, 235, 249, 0.88);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.12em;

    &::before,
    &::after {
      content: '';
      height: 1px;
      background: linear-gradient(90deg, rgba(83, 222, 255, 0.36), transparent);
    }

    &::before {
      width: 22px;
      flex-shrink: 0;
    }

    &::after {
      flex: 1;
    }
  }



  &__dept {

    list-style: none;

    padding: 12px 0 0;

    margin: 12px 0 0;

    border-top: 1px solid rgba(83, 222, 255, 0.18);

    &-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }



    li {

      display: flex;

      align-items: center;

      gap: 8px;

      min-width: 0;
      padding: 8px 9px;

      font-size: 13px;
      background:
        linear-gradient(135deg, rgba(7, 37, 58, 0.72), rgba(5, 20, 36, 0.48)),
        rgba(4, 16, 30, 0.34);
      border: 1px solid rgba(119, 231, 255, 0.13);
      border-radius: 10px;
      box-shadow: inset 0 1px 0 rgba(193, 247, 255, 0.06);
      transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;

      &:hover {
        border-color: rgba(131, 237, 255, 0.42);
        box-shadow: 0 0 16px rgba(55, 206, 255, 0.12);
        transform: translateY(-1px);
      }

    }

  }

}



.staff-role-card {

  appearance: none;
  position: relative;
  overflow: hidden;
  display: flex;

  flex-direction: column;

  align-items: center;

  gap: 9px;

  min-height: 154px;
  padding: 16px 10px 14px;

  border-radius: 12px;

  background:
    linear-gradient(155deg, rgba(7, 43, 66, 0.62), rgba(4, 16, 30, 0.42)),
    rgba(4, 16, 30, 0.26);

  border: 1px solid rgba(119, 231, 255, 0.13);
  color: inherit;
  font: inherit;
  cursor: default;

  box-shadow:
    inset 0 1px 0 rgba(193, 247, 255, 0.08),
    0 8px 18px rgba(0, 0, 0, 0.12);

  transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 10%;
    right: 10%;
    height: 1px;
    pointer-events: none;
    background: linear-gradient(90deg, transparent, rgba(142, 243, 255, 0.72), transparent);
    animation: staff-card-scan 6.4s ease-in-out infinite;
  }

  &:hover {
    transform: translateY(-1px);
    border-color: rgba(131, 237, 255, 0.45);
    box-shadow:
      0 12px 26px rgba(0, 0, 0, 0.18),
      0 0 20px rgba(55, 206, 255, 0.12),
      inset 0 1px 0 rgba(193, 247, 255, 0.12);
  }



  &--director {

    background:
      radial-gradient(circle at 50% 14%, rgba(79, 195, 247, 0.18), transparent 46%),
      linear-gradient(155deg, rgba(6, 48, 75, 0.74), rgba(4, 16, 30, 0.42));

    border-color: rgba(79, 195, 247, 0.25);

    box-shadow: inset 0 1px 0 rgba(79, 195, 247, 0.15);

  }



  &--nurse {

    background:
      radial-gradient(circle at 50% 14%, rgba(244, 143, 177, 0.18), transparent 46%),
      linear-gradient(155deg, rgba(62, 30, 55, 0.64), rgba(4, 16, 30, 0.42));

    border-color: rgba(244, 143, 177, 0.25);

    box-shadow: inset 0 1px 0 rgba(244, 143, 177, 0.15);

  }

  &--managed-doctor {
    background:
      radial-gradient(circle at 50% 16%, rgba(72, 213, 255, 0.24), transparent 48%),
      linear-gradient(160deg, rgba(7, 52, 78, 0.82), rgba(4, 17, 32, 0.48));
    border-color: rgba(72, 213, 255, 0.38);
    box-shadow:
      inset 0 1px 0 rgba(193, 247, 255, 0.14),
      0 0 22px rgba(72, 213, 255, 0.12);
  }

  &--managed-nurse {
    background:
      radial-gradient(circle at 50% 16%, rgba(255, 137, 194, 0.23), transparent 48%),
      linear-gradient(160deg, rgba(70, 31, 63, 0.76), rgba(4, 17, 32, 0.48));
    border-color: rgba(255, 137, 194, 0.38);
    box-shadow:
      inset 0 1px 0 rgba(255, 220, 238, 0.12),
      0 0 22px rgba(255, 91, 164, 0.12);
  }

  &.managed-care-card {
    min-height: 176px;
    padding-top: 18px;
    cursor: pointer;

    &::after {
      content: '';
      position: absolute;
      right: 12px;
      bottom: 12px;
      width: 16px;
      height: 16px;
      border-top: 1px solid rgba(164, 246, 255, 0.62);
      border-right: 1px solid rgba(164, 246, 255, 0.62);
      opacity: 0.58;
    }
  }



  &--director-general {

    background:
      linear-gradient(155deg, rgba(22, 53, 68, 0.58), rgba(4, 16, 30, 0.42)),
      rgba(255, 255, 255, 0.035);

    border-color: rgba(255, 255, 255, 0.1);

  }



  &--inline {

    flex-direction: row;

    align-items: center;

    min-height: 0;
    padding: 10px 12px;

    gap: 10px;

  }



  &__avatar-wrap {
    position: relative;
    padding: 3px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.12);
      pointer-events: none;
    }
  }

  &--director &__avatar-wrap {
    background: radial-gradient(circle, rgba(79, 195, 247, 0.18) 0%, rgba(79, 195, 247, 0.04) 70%);

    &::before {
      border-color: rgba(79, 195, 247, 0.45);
      box-shadow: 0 0 14px rgba(79, 195, 247, 0.28);
    }
  }

  &--nurse &__avatar-wrap {
    background: radial-gradient(circle, rgba(244, 143, 177, 0.18) 0%, rgba(244, 143, 177, 0.04) 70%);

    &::before {
      border-color: rgba(244, 143, 177, 0.45);
      box-shadow: 0 0 14px rgba(244, 143, 177, 0.28);
    }
  }



  &__avatar {

    width: 52px;

    height: 52px;

    border-radius: 50%;

    object-fit: cover;

    border: 2px solid rgba(255, 255, 255, 0.2);

    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);



    &--sm {

      width: 36px;

      height: 36px;

      flex-shrink: 0;

    }



    &--placeholder {

      display: flex;

      align-items: center;

      justify-content: center;

      font-size: 20px;

      font-weight: 700;

      color: #fff;

      background: linear-gradient(135deg, #546e7a, #37474f);

    }

  }



  &--director &__avatar--placeholder {

    background: linear-gradient(135deg, #0288d1, #01579b);

  }



  &--nurse &__avatar--placeholder {

    background: linear-gradient(135deg, #ec407a, #ad1457);

  }



  &__badge {

    padding: 3px 10px;

    border-radius: 10px;

    font-size: 11px;

    font-weight: 600;

    letter-spacing: 0.5px;



    &--sm {

      padding: 2px 8px;

      font-size: 10px;

    }

  }



  &--director &__badge {

    color: #4fc3f7;

    background: rgba(79, 195, 247, 0.18);

  }



  &--nurse &__badge {

    color: #f48fb1;

    background: rgba(244, 143, 177, 0.18);

  }



  &--director-general &__badge {

    color: #b0bec5;

    background: rgba(255, 255, 255, 0.08);

  }



  &__name {

    font-size: 15px;

    font-weight: 600;

    color: #fff;

    text-align: center;

    line-height: 1.3;

    word-break: break-all;
    max-width: 100%;



    &--sm {

      font-size: 13px;

      text-align: left;

    }

  }

  &__hint {
    color: rgba(167, 235, 249, 0.68);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
  }



  &__inline-info {

    display: flex;

    flex-direction: column;

    gap: 4px;

    min-width: 0;

  }

}

.staff-intro-modal {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(circle at 50% 38%, rgba(56, 215, 255, 0.14), transparent 34%),
    rgba(0, 8, 16, 0.58);
  backdrop-filter: blur(10px) saturate(125%);
  -webkit-backdrop-filter: blur(10px) saturate(125%);
}

.staff-intro-modal__card {
  position: relative;
  width: min(520px, calc(100vw - 40px));
  overflow: hidden;
  padding: 22px;
  border: 1px solid rgba(93, 225, 255, 0.42);
  border-radius: 18px;
  background:
    radial-gradient(circle at 16% 0%, rgba(91, 229, 255, 0.2), transparent 36%),
    radial-gradient(circle at 86% 8%, rgba(255, 123, 190, 0.14), transparent 34%),
    linear-gradient(150deg, rgba(11, 47, 72, 0.9), rgba(4, 18, 34, 0.86)),
    rgba(4, 15, 28, 0.9);
  box-shadow:
    0 24px 70px rgba(0, 0, 0, 0.46),
    0 0 44px rgba(72, 213, 255, 0.18),
    inset 0 1px 0 rgba(204, 249, 255, 0.14);
  animation: staff-intro-card-in 180ms cubic-bezier(0.22, 0.8, 0.24, 1) both;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, rgba(139, 242, 255, 0.92), transparent);
    box-shadow: 0 0 18px rgba(83, 222, 255, 0.5);
  }
}

.staff-intro-modal__close {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  width: 32px;
  height: 32px;
  border: 1px solid rgba(121, 228, 255, 0.26);
  border-radius: 50%;
  color: #c9f8ff;
  background: rgba(8, 29, 48, 0.72);
  font-size: 22px;
  line-height: 28px;
  cursor: pointer;
}

.staff-intro-modal__halo {
  position: absolute;
  top: -48px;
  right: -44px;
  width: 170px;
  height: 170px;
  border: 1px solid rgba(123, 235, 255, 0.24);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(82, 222, 255, 0.18), transparent 62%);
  pointer-events: none;
  animation: staff-intro-halo 5.6s ease-in-out infinite;
}

.staff-intro-modal__profile {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 16px;
  padding-right: 36px;

  span {
    display: inline-flex;
    margin-bottom: 8px;
    padding: 4px 10px;
    border: 1px solid rgba(93, 225, 255, 0.28);
    border-radius: 999px;
    color: #8af1ff;
    background: rgba(7, 32, 52, 0.72);
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.08em;
  }

  strong {
    display: block;
    color: #fff;
    font-size: 24px;
    font-weight: 900;
    letter-spacing: 0.04em;
    text-shadow: 0 0 16px rgba(82, 222, 255, 0.32);
  }
}

.staff-intro-modal__body {
  position: relative;
  z-index: 1;
  margin-top: 18px;
  padding: 16px;
  border: 1px solid rgba(93, 225, 255, 0.2);
  border-radius: 14px;
  background:
    linear-gradient(135deg, rgba(8, 39, 61, 0.66), rgba(5, 20, 36, 0.48)),
    rgba(5, 18, 32, 0.48);

  h4 {
    margin: 0 0 8px;
    color: #bdf6ff;
    font-size: 14px;
    letter-spacing: 0.12em;
  }

  p {
    margin: 0;
    max-height: 220px;
    overflow-y: auto;
    color: rgba(230, 247, 255, 0.9);
    font-size: 14px;
    line-height: 1.8;
    text-align: justify;
  }
}



.door-staff-cards--compact .staff-role-card {
  padding: 10px 8px 8px;
  gap: 7px;

  .staff-role-card__avatar-wrap {
    padding: 4px;
  }

  :deep(.staff-avatar--md) {
    width: 52px;
    height: 52px;
  }

  :deep(.staff-avatar--placeholder.staff-avatar--md) {
    font-size: 20px;
  }

  .staff-role-card__name {
    font-size: 12px;
  }

  .staff-role-card__badge {
    font-size: 10px;
    padding: 2px 8px;
  }
}



.dept-user {
  :deep(.staff-avatar--sm) {
    width: 28px;
    height: 28px;
    font-size: 12px;
  }

  &__name {

    flex: 1;
    min-width: 0;

    color: #e0e6ed;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

  }



  &__duty {

    flex-shrink: 0;
    max-width: 72px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;

    color: #a8dff0;

    padding: 3px 7px;

    background: rgba(8, 31, 49, 0.74);
    border: 1px solid rgba(119, 231, 255, 0.12);

    border-radius: 999px;

  }

}

</style>
