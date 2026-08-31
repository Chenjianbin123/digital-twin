<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { confirmSwpRole, loginSwpUser } from "@/api/auth";
import {
  clearAuthSession,
  confirmAuthRole,
  readAuthSession,
  readPendingAuth,
  replacePendingAuthToken,
  writePendingAuth,
} from "@/core/auth-session";
import type { AuthRole, AuthSession, AuthUser } from "@/types/auth";

const props = defineProps<{
  notice?: string;
}>();

const emit = defineEmits<{
  authenticated: [session: AuthSession];
}>();

const step = ref<"credentials" | "role">("credentials");
const userName = ref("");
const password = ref("");
const showPassword = ref(false);
const pendingUser = ref<AuthUser | null>(null);
const selectedRoleId = ref("");
const isSubmitting = ref(false);
const errorMessage = ref("");

const displayName = computed(
  () =>
    pendingUser.value?.userRealname ||
    pendingUser.value?.userName ||
    "值班人员",
);

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function selectRole(role: AuthRole) {
  selectedRoleId.value = String(role.id);
  errorMessage.value = "";
}

async function submitCredentials() {
  errorMessage.value = "";
  const normalizedName = userName.value.trim();
  if (!normalizedName || !password.value) {
    errorMessage.value = "请输入平台账号和登录密码";
    return;
  }

  isSubmitting.value = true;
  try {
    const user = await loginSwpUser({
      userName: normalizedName,
      password: password.value,
    });
    if (!Array.isArray(user.roleList) || !user.roleList.length) {
      clearAuthSession();
      throw new Error("当前账号未分配角色，请联系管理员");
    }
    writePendingAuth(user);
    pendingUser.value = user;
    selectedRoleId.value = "";
    password.value = "";
    step.value = "role";
  } catch (error) {
    errorMessage.value = errorText(error, "登录失败，请稍后重试");
  } finally {
    isSubmitting.value = false;
  }
}

async function submitRole() {
  const user = pendingUser.value;
  const role = user?.roleList.find(
    (item) => String(item.id) === selectedRoleId.value,
  );
  if (!user || !role) {
    errorMessage.value = "请选择本次值班角色";
    return;
  }

  isSubmitting.value = true;
  errorMessage.value = "";
  try {
    const confirmedToken = await confirmSwpRole(role.id, user.token);
    if (confirmedToken) {
      replacePendingAuthToken(confirmedToken);
      user.token = confirmedToken;
    }
    confirmAuthRole(role);
    const session = readAuthSession();
    if (!session) throw new Error("登录会话保存失败，请重新登录");
    emit("authenticated", session);
  } catch (error) {
    errorMessage.value = errorText(error, "角色确认失败，请稍后重试");
  } finally {
    isSubmitting.value = false;
  }
}

function restartLogin() {
  clearAuthSession();
  pendingUser.value = null;
  selectedRoleId.value = "";
  errorMessage.value = "";
  step.value = "credentials";
}

onMounted(() => {
  const pending = readPendingAuth();
  if (!pending?.user.roleList?.length) return;
  pendingUser.value = pending.user;
  step.value = "role";
});
</script>

<template>
  <main class="swp-login">
    <img
      class="swp-login__scene"
      src="/images/smart-ward-nurse-station/login-bg.png"
      alt="智慧病房护士站"
    />
    <div class="swp-login__shade" aria-hidden="true" />

    <section class="swp-login__brand" aria-label="系统名称">
      <h1>智慧病房数字孪生平台</h1>
      <span>护士站实时空间态势</span>
    </section>

    <aside class="swp-login__rail" aria-label="智慧病房数字孪生平台登录">
      <div v-if="step === 'credentials'" class="swp-login__content">
        <h2>智慧病房数字孪生平台</h2>

        <form class="swp-login__form" @submit.prevent="submitCredentials">
          <label class="swp-login__field">
            <span>账号</span>
            <input
              v-model="userName"
              name="username"
              type="text"
              autocomplete="username"
              placeholder="请输入用户名"
              :disabled="isSubmitting"
            />
          </label>

          <label class="swp-login__field">
            <span>密码</span>
            <span class="swp-login__password">
              <input
                v-model="password"
                name="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="请输入密码"
                :disabled="isSubmitting"
              />
              <button
                type="button"
                :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                :title="showPassword ? '隐藏密码' : '显示密码'"
                @click="showPassword = !showPassword"
              >
                {{ showPassword ? "隐藏" : "显示" }}
              </button>
            </span>
          </label>

          <button
            class="swp-login__submit"
            type="submit"
            :disabled="isSubmitting"
          >
            {{ isSubmitting ? "正在登录..." : "登录" }}
          </button>
        </form>
      </div>

      <div v-else class="swp-login__content swp-login__content--roles">
        <h2>确认值班角色</h2>
        <p class="swp-login__subtitle">{{ displayName }}，请选择本次值班角色</p>

        <div class="swp-login__roles" role="radiogroup" aria-label="值班角色">
          <label
            v-for="role in pendingUser?.roleList ?? []"
            :key="String(role.id)"
            class="swp-login__role"
            :class="{
              'swp-login__role--selected': selectedRoleId === String(role.id),
            }"
          >
            <input
              type="radio"
              name="role"
              :value="String(role.id)"
              :checked="selectedRoleId === String(role.id)"
              @change="selectRole(role)"
            />
            <span class="swp-login__role-indicator" aria-hidden="true" />
            <span>
              <strong>{{ role.roleName }}</strong>
              <small>病区数字孪生访问权限</small>
            </span>
          </label>
        </div>

        <button
          class="swp-login__submit"
          type="button"
          :disabled="isSubmitting"
          @click="submitRole"
        >
          {{ isSubmitting ? "正在确认..." : "确认并进入" }}
        </button>
        <button
          class="swp-login__back"
          type="button"
          :disabled="isSubmitting"
          @click="restartLogin"
        >
          切换账号
        </button>
      </div>

      <p
        v-if="errorMessage || props.notice"
        class="swp-login__message"
        aria-live="polite"
      >
        {{ errorMessage || props.notice }}
      </p>
    </aside>
  </main>
</template>

<style scoped lang="scss">
.swp-login {
  position: relative;
  width: 100%;
  min-height: 100dvh;
  overflow: hidden;
  color: #e9fbff;
  background: #06141c;

  &__scene {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
  }

  &__shade {
    position: absolute;
    inset: 0;
    background: rgba(2, 11, 17, 0.32);
    box-shadow: inset 0 -180px 160px rgba(2, 11, 17, 0.52);
  }

  &__brand {
    position: absolute;
    z-index: 2;
    left: clamp(24px, 4vw, 64px);
    bottom: clamp(32px, 7vh, 76px);
    max-width: min(560px, 52vw);
    padding-left: 18px;
    border-left: 3px solid #51d5d0;
    text-shadow: 0 2px 18px rgba(0, 0, 0, 0.68);

    h1 {
      margin: 0;
      font-size: clamp(28px, 3.3vw, 52px);
      line-height: 1.14;
      letter-spacing: 0;
    }

    span {
      display: block;
      margin-top: 10px;
      color: rgba(221, 246, 250, 0.78);
      font-size: 15px;
    }
  }

  &__rail {
    position: absolute;
    z-index: 3;
    top: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    width: clamp(380px, 33vw, 500px);
    height: 100%;
    padding: clamp(28px, 5vh, 56px) clamp(28px, 3vw, 48px);
    background: rgba(5, 22, 30, 0.94);
    border-left: 1px solid rgba(81, 213, 208, 0.42);
    box-shadow: -24px 0 60px rgba(0, 0, 0, 0.28);
  }

  &__content {
    display: flex;
    flex: 1;
    min-height: 0;
    flex-direction: column;
    justify-content: center;
    padding: 0;

    h2 {
      margin: 0;
      font-size: 28px;
      line-height: 1.2;
      letter-spacing: 0;
    }

    &--roles {
      justify-content: center;
    }
  }

  &__subtitle {
    margin: 10px 0 0;
    color: #91abb1;
    font-size: 13px;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }

  &__form {
    display: grid;
    gap: 20px;
    margin-top: 34px;
  }

  &__field {
    display: grid;
    gap: 8px;

    > span:first-child {
      color: #afc6ca;
      font-size: 12px;
      font-weight: 600;
    }

    input {
      width: 100%;
      height: 46px;
      padding: 0 14px;
      border: 1px solid #35545d;
      border-radius: 4px;
      outline: none;
      color: #edfdfd;
      font: inherit;
      font-size: 14px;
      background: #0b2a34;
      transition:
        border-color 0.15s,
        box-shadow 0.15s;

      &::placeholder {
        color: #69878e;
      }

      &:focus {
        border-color: #58d7d2;
        box-shadow: 0 0 0 3px rgba(81, 213, 208, 0.14);
      }

      &:disabled {
        opacity: 0.62;
      }
    }
  }

  &__password {
    position: relative;
    display: block;

    input {
      padding-right: 62px;
    }

    button {
      position: absolute;
      top: 50%;
      right: 8px;
      height: 30px;
      padding: 0 8px;
      border: 0;
      color: #72dcd7;
      font-size: 12px;
      background: transparent;
      cursor: pointer;
      transform: translateY(-50%);
    }
  }

  &__submit {
    width: 100%;
    min-height: 46px;
    margin-top: 6px;
    border: 1px solid #62e0db;
    border-radius: 4px;
    color: #052329;
    font-size: 14px;
    font-weight: 800;
    background: #51d5d0;
    cursor: pointer;
    transition:
      background 0.15s,
      box-shadow 0.15s,
      transform 0.15s;

    &:hover:not(:disabled) {
      background: #72e3df;
      box-shadow: 0 8px 24px rgba(81, 213, 208, 0.2);
      transform: translateY(-1px);
    }

    &:focus-visible {
      outline: 2px solid #fff;
      outline-offset: 3px;
    }

    &:disabled {
      opacity: 0.58;
      cursor: wait;
    }
  }

  &__roles {
    display: grid;
    max-height: min(300px, 34vh);
    gap: 8px;
    margin-top: 26px;
    overflow-y: auto;
  }

  &__role {
    display: grid;
    min-height: 62px;
    padding: 11px 12px;
    border: 1px solid #2e4d56;
    border-radius: 4px;
    grid-template-columns: 18px minmax(0, 1fr);
    align-items: center;
    gap: 11px;
    background: #09252f;
    cursor: pointer;

    input {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
    }

    &--selected {
      border-color: #d8ad58;
      background: #102d34;

      .swp-login__role-indicator {
        border-color: #f0c66f;
        box-shadow: inset 0 0 0 4px #102d34;
        background: #f0c66f;
      }
    }

    strong,
    small {
      display: block;
      overflow-wrap: anywhere;
    }

    strong {
      font-size: 14px;
    }

    small {
      margin-top: 4px;
      color: #79979e;
      font-size: 11px;
    }
  }

  &__role-indicator {
    width: 16px;
    height: 16px;
    border: 1px solid #5f7d84;
    border-radius: 50%;
  }

  &__back {
    min-height: 36px;
    margin-top: 9px;
    border: 0;
    color: #8eb3b9;
    font-size: 12px;
    background: transparent;
    cursor: pointer;
  }

  &__message {
    flex: 0 0 auto;
    margin: 0 0 16px;
    padding: 10px 12px;
    border-left: 2px solid #f0b55f;
    color: #ffd79c;
    font-size: 12px;
    line-height: 1.5;
    background: rgba(115, 72, 18, 0.22);
    overflow-wrap: anywhere;
  }
}

@media (max-width: 768px) {
  .swp-login {
    display: flex;
    min-height: 100dvh;
    align-items: flex-end;

    &__scene {
      height: 42%;
      object-position: center top;
    }

    &__shade {
      background: rgba(2, 11, 17, 0.18);
      box-shadow: inset 0 -100px 90px #05161e;
    }

    &__brand {
      top: 28px;
      bottom: auto;
      left: 20px;
      max-width: calc(100% - 40px);

      h1 {
        font-size: 25px;
      }

      span {
        font-size: 12px;
      }
    }

    &__rail {
      position: relative;
      width: 100%;
      height: min(68dvh, 620px);
      min-height: 500px;
      padding: 20px 22px 18px;
      border-top: 1px solid rgba(81, 213, 208, 0.42);
      border-left: 0;
      overflow-y: auto;
    }

    &__content {
      flex: 0 0 auto;
      justify-content: flex-start;
      padding: 20px 0 12px;

      h2 {
        font-size: 24px;
      }
    }

    &__form {
      gap: 14px;
      margin-top: 24px;
    }

    &__roles {
      max-height: 190px;
    }
  }
}
</style>
