<script setup lang="ts">

import { computed } from 'vue';
import StaffAvatar from '@/components/StaffAvatar.vue';
import { buildMainStaffList } from '@/core/door-staff';
import type { DoorDeptUser, DoorMainStaff } from '@/types/ward';

function avatarRole(roleKey: string): 'director' | 'nurse' | 'default' {
  if (roleKey === 'deptDirector')
    return 'director';
  if (roleKey === 'areaHeadNurse')
    return 'nurse';
  return 'default';
}



const props = withDefaults(defineProps<{

  staff?: DoorMainStaff;

  deptUsers?: DoorDeptUser[];

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



function roleClass(roleKey: string) {

  if (roleKey === 'deptDirector')

    return 'staff-role-card--director';

  if (roleKey === 'areaHeadNurse')

    return 'staff-role-card--nurse';

  return 'staff-role-card--director-general';

}

</script>



<template>

  <section

    v-if="primaryStaff.length || otherStaff.length || deptUsers?.length"

    class="door-staff-cards"

    :class="{ 'door-staff-cards--compact': compact }"

  >

    <h3 v-if="!compact" class="door-staff-cards__title">

      {{ title }}

    </h3>



    <div v-if="primaryStaff.length" class="door-staff-cards__primary">

      <div

        v-for="item in primaryStaff"

        :key="item.roleKey"

        class="staff-role-card"

        :class="roleClass(item.roleKey)"

      >

        <div class="staff-role-card__avatar-wrap">
          <StaffAvatar
            :pic="item.pic"
            :name="item.name"
            :size="compact ? 'md' : 'lg'"
            :role="avatarRole(item.roleKey)"
          />
        </div>

        <span class="staff-role-card__badge">{{ item.role }}</span>

        <span class="staff-role-card__name">{{ item.name }}</span>

      </div>

    </div>



    <div v-if="otherStaff.length && !primaryOnly" class="door-staff-cards__other">

      <div

        v-for="item in otherStaff"

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



    <ul v-if="deptUsers?.length && !compact" class="door-staff-cards__dept">

      <li v-for="(user, i) in deptUsers" :key="i">

        <StaffAvatar
          :pic="user.userPic"
          :name="user.userRealname"
          size="sm"
        />

        <span class="dept-user__name">{{ user.userRealname }}</span>

        <span v-if="user.userDuty" class="dept-user__duty">{{ user.userDuty }}</span>

      </li>

    </ul>

  </section>

</template>



<style scoped lang="scss">

.door-staff-cards {

  margin-bottom: 16px;

  padding: 14px;

  background: rgba(6, 20, 36, 0.28);

  border: 1px solid rgba(77, 208, 255, 0.11);

  border-radius: 10px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);



  &--compact {

    margin-bottom: 8px;

    padding: 0;

    background: none;

  }



  &__title {

    margin: 0 0 12px;

    font-size: 13px;
    font-weight: 700;

    color: #9be8ff;

  }



  &__primary {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;

    @include down($bp-xs) {
      grid-template-columns: 1fr;
    }
  }



  &--compact &__primary {

    gap: 8px;

  }



  &__other {

    margin-top: 10px;

    display: flex;

    flex-direction: column;

    gap: 8px;

  }



  &__dept {

    list-style: none;

    padding: 10px 0 0;

    margin: 10px 0 0;

    border-top: 1px solid rgba(77, 208, 255, 0.1);



    li {

      display: flex;

      align-items: center;

      gap: 8px;

      padding: 6px 0;

      font-size: 13px;

    }

  }

}



.staff-role-card {

  display: flex;

  flex-direction: column;

  align-items: center;

  gap: 8px;

  padding: 14px 10px 12px;

  border-radius: 9px;

  background: rgba(4, 16, 30, 0.26);

  border: 1px solid rgba(255, 255, 255, 0.055);

  transition: transform 0.15s, box-shadow 0.15s;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.16);
  }



  &--director {

    background: rgba(79, 195, 247, 0.08);

    border-color: rgba(79, 195, 247, 0.25);

    box-shadow: inset 0 1px 0 rgba(79, 195, 247, 0.15);

  }



  &--nurse {

    background: rgba(244, 143, 177, 0.08);

    border-color: rgba(244, 143, 177, 0.25);

    box-shadow: inset 0 1px 0 rgba(244, 143, 177, 0.15);

  }



  &--director-general {

    background: rgba(255, 255, 255, 0.04);

    border-color: rgba(255, 255, 255, 0.1);

  }



  &--inline {

    flex-direction: row;

    align-items: center;

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



  &__inline-info {

    display: flex;

    flex-direction: column;

    gap: 4px;

    min-width: 0;

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

    color: #e0e6ed;

  }



  &__duty {

    font-size: 11px;

    color: #8fa3b8;

    padding: 2px 6px;

    background: rgba(0, 0, 0, 0.25);

    border-radius: 4px;

  }

}

</style>
