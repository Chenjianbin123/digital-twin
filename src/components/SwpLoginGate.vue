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
      src="/images/smart-ward-nurse-station/login-bg.jpg"
      alt="智慧病房护士站"
    />
    <div class="swp-login__shade" aria-hidden="true" />
    <div class="swp-login__tech-grid" aria-hidden="true" />
    <div class="swp-login__scanline" aria-hidden="true" />
    <div
      class="swp-login__signal swp-login__signal--left"
      aria-hidden="true"
    />
    <div
      class="swp-login__signal swp-login__signal--right"
      aria-hidden="true"
    />

    <section class="swp-login__brand" aria-label="系统名称">
      <div class="swp-login__brand-mark" aria-hidden="true">
        <span>智</span>
      </div>
      <p class="swp-login__brand-kicker">智慧病房 · 实时运营</p>
      <h1>智慧病房数字孪生平台</h1>
      <p>让病区状态清晰可见，让护理协同更高效</p>
      <div class="swp-login__brand-points" aria-label="平台能力">
        <span>病区态势</span>
        <span>设备联动</span>
        <span>护理协同</span>
      </div>
    </section>

    <aside class="swp-login__rail" aria-label="智慧病房数字孪生平台登录">
      <div class="swp-login__card">
        <header class="swp-login__card-head">
          <div class="swp-login__card-identity">
            <span class="swp-login__card-mark" aria-hidden="true">智</span>
            <span>
              <strong>智慧病房</strong>
              <small>数字孪生运营平台</small>
            </span>
          </div>
          <span class="swp-login__secure">
            <i aria-hidden="true" />
            安全登录
          </span>
        </header>

        <nav class="swp-login__steps" aria-label="登录流程">
          <span
            class="swp-login__step"
            :class="{
              'swp-login__step--active': step === 'credentials',
              'swp-login__step--done': step === 'role',
            }"
          >
            <i>01</i>
            <span>账号验证</span>
          </span>
          <b class="swp-login__step-line" aria-hidden="true" />
          <span
            class="swp-login__step"
            :class="{ 'swp-login__step--active': step === 'role' }"
          >
            <i>02</i>
            <span>角色确认</span>
          </span>
        </nav>

        <div v-if="step === 'credentials'" class="swp-login__content">
          <div class="swp-login__heading">
            <span class="swp-login__eyebrow">授权入口</span>
            <h2>进入智慧病房</h2>
            <p class="swp-login__subtitle">登录后查看授权病区的实时态势</p>
          </div>

          <div class="swp-login__support" aria-label="平台能力">
            <span class="swp-login__support-item">
              <i aria-hidden="true">态</i>
              <span>
                <strong>病区态势</strong>
                <small>空间可视化</small>
              </span>
            </span>
            <span class="swp-login__support-item">
              <i aria-hidden="true">联</i>
              <span>
                <strong>设备联动</strong>
                <small>状态可追踪</small>
              </span>
            </span>
            <span class="swp-login__support-item">
              <i aria-hidden="true">护</i>
              <span>
                <strong>护理协同</strong>
                <small>任务更清晰</small>
              </span>
            </span>
          </div>

          <form class="swp-login__form" @submit.prevent="submitCredentials">
            <label class="swp-login__field">
              <span class="swp-login__field-head">
                <span>账号</span>
                <small>工作账号</small>
              </span>
              <span class="swp-login__input-wrap">
                <span
                  class="swp-login__input-icon swp-login__input-icon--user"
                  aria-hidden="true"
                />
                <input
                  v-model="userName"
                  name="username"
                  type="text"
                  autocomplete="username"
                  placeholder="请输入账号"
                  :disabled="isSubmitting"
                />
              </span>
            </label>

            <label class="swp-login__field">
              <span class="swp-login__field-head">
                <span>密码</span>
                <small>登录凭证</small>
              </span>
              <span class="swp-login__password">
                <span
                  class="swp-login__input-icon swp-login__input-icon--lock"
                  aria-hidden="true"
                />
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
              <span>{{ isSubmitting ? "正在登录..." : "登录并继续" }}</span>
              <i aria-hidden="true">→</i>
            </button>
          </form>
        </div>

        <div v-else class="swp-login__content swp-login__content--roles">
          <div class="swp-login__heading">
            <span class="swp-login__eyebrow">账号验证完成</span>
            <h2>确认值班角色</h2>
            <p class="swp-login__subtitle">
              {{ displayName }}，请选择本次值班角色
            </p>
          </div>

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
              <span class="swp-login__role-copy">
                <strong>{{ role.roleName }}</strong>
                <small>病区数字孪生访问权限</small>
              </span>
              <span class="swp-login__role-arrow" aria-hidden="true">→</span>
            </label>
          </div>

          <button
            class="swp-login__submit"
            type="button"
            :disabled="isSubmitting"
            @click="submitRole"
          >
            <span>{{ isSubmitting ? "正在确认..." : "确认并进入" }}</span>
            <i aria-hidden="true">→</i>
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
          <i aria-hidden="true">!</i>
          <span>{{ errorMessage || props.notice }}</span>
        </p>

        <footer class="swp-login__card-foot">
          <span>仅展示当前账号授权病区</span>
          <span>权限校验后进入</span>
        </footer>
      </div>
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

/* 登录页自适应视觉层：桌面浮动卡片 / 小屏底部抽屉 */
.swp-login {
  --login-ink: #effcff;
  --login-muted: #8da8b3;
  --login-subtle: #6f8994;
  --login-line: rgba(163, 225, 229, 0.2);
  --login-accent: #65e0d3;
  --login-accent-strong: #2fc1bd;
  --login-panel-alpha: 0.62;
  --login-panel: rgba(7, 25, 38, var(--login-panel-alpha));
  --login-field: rgba(12, 45, 58, 0.72);
  min-height: 100svh;
  min-height: 100dvh;
  isolation: isolate;
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
  background:
    radial-gradient(
      circle at 18% 18%,
      rgba(70, 170, 179, 0.16),
      transparent 34%
    ),
    #06141c;

  &::after {
    position: absolute;
    z-index: 1;
    inset: 0;
    pointer-events: none;
    content: "";
    background:
      linear-gradient(
        90deg,
        rgba(4, 17, 27, 0.08),
        transparent 52%,
        rgba(2, 12, 20, 0.26)
      ),
      linear-gradient(
        180deg,
        rgba(3, 13, 21, 0.08),
        transparent 42%,
        rgba(1, 9, 15, 0.52)
      );
  }

  &__scene {
    z-index: 0;
    object-position: 38% center;
    filter: saturate(0.9) contrast(1.02);
  }

  &__shade {
    z-index: 1;
    background:
      linear-gradient(
        90deg,
        rgba(3, 13, 21, 0.08) 0%,
        rgba(3, 13, 21, 0.12) 48%,
        rgba(3, 13, 21, 0.58) 100%
      ),
      linear-gradient(
        180deg,
        rgba(3, 13, 21, 0.18),
        transparent 44%,
        rgba(3, 13, 21, 0.62)
      );
    box-shadow: inset 0 -180px 180px rgba(2, 11, 17, 0.4);
  }

  &__brand {
    z-index: 3;
    left: clamp(28px, 5.4vw, 90px);
    bottom: clamp(34px, 8vh, 96px);
    max-width: min(620px, 54vw);
    padding: 0 0 0 clamp(18px, 1.6vw, 28px);
    border-left: 1px solid rgba(101, 224, 211, 0.72);
    text-shadow: 0 8px 30px rgba(0, 0, 0, 0.64);

    &::before {
      position: absolute;
      top: 0;
      left: -2px;
      width: 3px;
      height: clamp(48px, 6vh, 76px);
      border-radius: 99px;
      background: var(--login-accent);
      box-shadow: 0 0 20px rgba(101, 224, 211, 0.45);
      content: "";
    }

    h1 {
      margin: 0;
      color: #f1feff;
      font-size: clamp(30px, 3.45vw, 58px);
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.15;
    }

    > p {
      margin: 0;
    }
  }

  &__brand-mark {
    display: grid;
    width: 42px;
    height: 42px;
    margin-bottom: 18px;
    place-items: center;
    border: 1px solid rgba(130, 236, 227, 0.58);
    border-radius: 13px;
    color: #d9fffb;
    font-size: 18px;
    font-weight: 800;
    background: rgba(18, 76, 84, 0.58);
    box-shadow:
      0 10px 24px rgba(0, 0, 0, 0.18),
      0 0 28px rgba(79, 210, 205, 0.14) inset;
  }

  &__brand-kicker {
    margin-bottom: 12px !important;
    color: rgba(177, 243, 239, 0.86);
    font-size: clamp(12px, 1vw, 14px);
    font-weight: 600;
    letter-spacing: 0.16em;
  }

  &__brand > p:not(.swp-login__brand-kicker) {
    margin-top: 14px;
    color: rgba(220, 247, 247, 0.76);
    font-size: clamp(14px, 1.15vw, 17px);
    letter-spacing: 0.06em;
  }

  &__brand-points {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 28px;

    span {
      display: inline-flex !important;
      width: auto;
      height: 28px;
      margin: 0 !important;
      padding: 0 11px;
      align-items: center;
      border: 1px solid rgba(172, 232, 232, 0.18);
      border-radius: 999px;
      color: rgba(218, 247, 246, 0.72);
      font-size: 11px;
      letter-spacing: 0.04em;
      background: rgba(6, 33, 43, 0.42);
    }
  }

  &__rail {
    position: absolute;
    z-index: 4;
    top: 32px;
    right: 32px;
    bottom: 32px;
    display: flex;
    width: min(100% - 48px, 560px);
    height: auto;
    max-height: calc(100dvh - 64px);
    margin: 0;
    padding: 0;
    align-items: center;
    justify-content: center;
    border: 0;
    background: transparent;
    box-shadow: none;
  }

  &__card {
    display: flex;
    width: 100%;
    max-height: 100%;
    min-height: 0;
    flex-direction: column;
    padding: clamp(28px, 4.2vh, 48px) clamp(26px, 3vw, 46px)
      clamp(20px, 3vh, 30px);
    overflow-y: auto;
    border: 1px solid rgba(166, 232, 230, 0.24);
    border-radius: 28px;
    color: var(--login-ink);
    background:
      linear-gradient(145deg, rgba(18, 57, 70, 0.34), transparent 42%),
      var(--login-panel);
    box-shadow:
      -28px 28px 70px rgba(0, 0, 0, 0.28),
      0 0 0 1px rgba(255, 255, 255, 0.025) inset,
      0 0 42px rgba(64, 206, 200, 0.08) inset;
    backdrop-filter: blur(18px) saturate(1.12);
    scrollbar-color: rgba(112, 210, 207, 0.36) transparent;
    scrollbar-width: thin;
  }

  &__card-head {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding-bottom: 24px;
    border-bottom: 1px solid rgba(166, 232, 230, 0.12);
  }

  &__card-identity {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 11px;

    > span:last-child {
      display: grid;
      min-width: 0;
      gap: 3px;
    }

    strong,
    small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    strong {
      color: #ecffff;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }

    small {
      color: var(--login-subtle);
      font-size: 11px;
    }
  }

  &__card-mark {
    display: grid;
    width: 34px;
    height: 34px;
    flex: 0 0 auto;
    place-items: center;
    border: 1px solid rgba(113, 229, 220, 0.38);
    border-radius: 11px;
    color: #dffffb;
    font-size: 15px;
    font-weight: 800;
    background: rgba(23, 104, 105, 0.5);
  }

  &__secure {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 6px;
    color: rgba(170, 226, 226, 0.72);
    font-size: 11px;
    white-space: nowrap;

    i {
      display: block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #64e3ae;
      box-shadow: 0 0 12px rgba(100, 227, 174, 0.8);
    }
  }

  &__content {
    display: flex;
    width: 100%;
    flex: 1 1 auto;
    min-height: 0;
    flex-direction: column;
    justify-content: center;
    padding: clamp(10px, 1vh, 40px) 0 clamp(24px, 4vh, 42px);

    &--roles {
      justify-content: flex-start;
    }

    h2 {
      margin: 7px 0 0;
      color: #f2ffff;
      font-size: clamp(26px, 2vw, 32px);
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.2;
    }
  }

  &__heading {
    flex: 0 0 auto;
  }

  &__eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--login-accent);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;

    &::before {
      width: 18px;
      height: 1px;
      background: currentColor;
      content: "";
    }
  }

  &__subtitle {
    margin: 11px 0 0;
    color: var(--login-muted);
    font-size: 13px;
    line-height: 1.65;
    overflow-wrap: anywhere;
  }

  &__form {
    display: grid;
    gap: 20px;
    margin-top: clamp(28px, 4vh, 42px);
  }

  &__field {
    display: grid;
    gap: 9px;

    > span:first-child {
      color: inherit;
      font-size: inherit;
      font-weight: inherit;
    }
  }

  &__field-head {
    display: flex !important;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: #c2dadd !important;
    font-size: 12px !important;
    font-weight: 650 !important;

    small {
      color: #6f8994;
      font-size: 10px;
      font-weight: 400;
    }
  }

  &__input-wrap,
  &__password {
    position: relative;
    display: block;
  }

  &__field input {
    box-sizing: border-box;
    width: 100%;
    height: clamp(48px, 6vh, 56px);
    padding: 0 16px 0 46px;
    border: 1px solid var(--login-line);
    border-radius: 14px;
    outline: none;
    color: #edffff;
    font: inherit;
    font-size: 14px;
    background: var(--login-field);
    box-shadow: 0 5px 18px rgba(1, 14, 22, 0.12) inset;
    transition:
      border-color 0.2s ease,
      background 0.2s ease,
      box-shadow 0.2s ease;

    &::placeholder {
      color: #698791;
    }

    &:hover:not(:disabled) {
      border-color: rgba(145, 225, 223, 0.38);
      background: rgba(13, 53, 66, 0.82);
    }

    &:focus {
      border-color: rgba(101, 224, 211, 0.86);
      background: rgba(14, 57, 69, 0.88);
      box-shadow:
        0 0 0 4px rgba(101, 224, 211, 0.1),
        0 5px 18px rgba(1, 14, 22, 0.12) inset;
    }

    &:disabled {
      opacity: 0.58;
    }
  }

  &__password input {
    padding-right: 72px;
  }

  &__input-icon {
    position: absolute;
    z-index: 1;
    top: 50%;
    left: 17px;
    width: 18px;
    height: 18px;
    color: rgba(130, 216, 215, 0.72);
    pointer-events: none;
    transform: translateY(-50%);
  }

  &__input-icon--user {
    &::before {
      position: absolute;
      top: 1px;
      left: 5px;
      width: 6px;
      height: 6px;
      border: 1.5px solid currentColor;
      border-radius: 50%;
      content: "";
    }

    &::after {
      position: absolute;
      bottom: 1px;
      left: 2px;
      width: 12px;
      height: 7px;
      border: 1.5px solid currentColor;
      border-radius: 8px 8px 4px 4px;
      content: "";
    }
  }

  &__input-icon--lock {
    &::before {
      position: absolute;
      top: 7px;
      left: 3px;
      width: 12px;
      height: 9px;
      border: 1.5px solid currentColor;
      border-radius: 3px;
      content: "";
    }

    &::after {
      position: absolute;
      top: 2px;
      left: 6px;
      width: 6px;
      height: 9px;
      border: 1.5px solid currentColor;
      border-bottom: 0;
      border-radius: 8px 8px 0 0;
      content: "";
    }
  }

  &__password button {
    position: absolute;
    top: 50%;
    right: 10px;
    min-width: 48px;
    height: 30px;
    padding: 0 9px;
    border: 1px solid rgba(124, 215, 213, 0.22);
    border-radius: 8px;
    color: #8fe8e1;
    font-size: 11px;
    background: rgba(75, 167, 165, 0.1);
    cursor: pointer;
    transform: translateY(-50%);
    transition:
      background 0.2s ease,
      border-color 0.2s ease;

    &:hover,
    &:focus-visible {
      border-color: rgba(124, 215, 213, 0.52);
      background: rgba(75, 167, 165, 0.22);
    }

    &:focus-visible {
      outline: 2px solid rgba(228, 255, 253, 0.9);
      outline-offset: 2px;
    }
  }

  &__submit {
    display: flex;
    width: 100%;
    min-height: clamp(48px, 6vh, 56px);
    margin-top: 7px;
    padding: 0 18px 0 22px;
    align-items: center;
    justify-content: space-between;
    border: 1px solid rgba(183, 255, 249, 0.68);
    border-radius: 14px;
    color: #05292f;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0.06em;
    background: linear-gradient(135deg, #80efe0, #4bcfc9);
    box-shadow:
      0 14px 28px rgba(35, 187, 180, 0.2),
      0 1px 0 rgba(255, 255, 255, 0.4) inset;
    cursor: pointer;
    transition:
      box-shadow 0.2s ease,
      filter 0.2s ease,
      transform 0.2s ease;

    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    i {
      display: grid;
      width: 26px;
      height: 26px;
      place-items: center;
      border: 1px solid rgba(4, 55, 62, 0.18);
      border-radius: 50%;
      font-size: 18px;
      font-style: normal;
      line-height: 1;
    }

    &:hover:not(:disabled) {
      filter: brightness(1.06);
      box-shadow:
        0 17px 34px rgba(35, 187, 180, 0.28),
        0 1px 0 rgba(255, 255, 255, 0.5) inset;
      transform: translateY(-2px);
    }

    &:focus-visible {
      outline: 2px solid #f5ffff;
      outline-offset: 4px;
    }

    &:disabled {
      cursor: wait;
      filter: saturate(0.55);
      opacity: 0.64;
    }
  }

  &__roles {
    display: grid;
    max-height: min(330px, 38vh);
    gap: 10px;
    margin-top: 30px;
    padding: 2px;
    overflow-y: auto;
    scrollbar-color: rgba(112, 210, 207, 0.36) transparent;
    scrollbar-width: thin;
  }

  &__role {
    display: grid;
    min-height: 68px;
    padding: 12px 13px;
    grid-template-columns: 20px minmax(0, 1fr) 20px;
    align-items: center;
    gap: 12px;
    border: 1px solid rgba(151, 219, 220, 0.18);
    border-radius: 14px;
    background: rgba(13, 47, 59, 0.52);
    cursor: pointer;
    transition:
      border-color 0.2s ease,
      background 0.2s ease,
      transform 0.2s ease;

    &:hover {
      border-color: rgba(151, 219, 220, 0.44);
      background: rgba(20, 67, 76, 0.6);
      transform: translateY(-1px);
    }

    input {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
    }

    input:focus-visible + .swp-login__role-indicator {
      outline: 2px solid #e7ffff;
      outline-offset: 3px;
    }

    &--selected {
      border-color: rgba(240, 211, 126, 0.8);
      background:
        linear-gradient(100deg, rgba(129, 112, 45, 0.22), transparent 72%),
        rgba(35, 66, 62, 0.72);
      box-shadow: 0 0 0 1px rgba(240, 211, 126, 0.08) inset;

      .swp-login__role-indicator {
        border-color: #f4d77f;
        box-shadow: inset 0 0 0 4px #1b413f;
        background: #f4d77f;
      }

      .swp-login__role-arrow {
        color: #f4d77f;
        transform: translateX(2px);
      }
    }

    strong,
    small {
      display: block;
      overflow-wrap: anywhere;
    }

    strong {
      color: #eafdfd;
      font-size: 14px;
      font-weight: 700;
    }

    small {
      margin-top: 5px;
      color: #7e9fa5;
      font-size: 11px;
    }
  }

  &__role-indicator {
    width: 17px;
    height: 17px;
    border: 1px solid #62838a;
    border-radius: 50%;
    transition:
      border-color 0.2s ease,
      background 0.2s ease,
      box-shadow 0.2s ease;
  }

  &__role-copy {
    min-width: 0;
  }

  &__role-arrow {
    color: #698b95;
    font-size: 18px;
    font-style: normal;
    text-align: right;
    transition:
      color 0.2s ease,
      transform 0.2s ease;
  }

  &__back {
    min-height: 38px;
    margin-top: 10px;
    border: 0;
    color: #8fb8bd;
    font-size: 12px;
    background: transparent;
    cursor: pointer;

    &:hover:not(:disabled) {
      color: #c4eeec;
    }

    &:focus-visible {
      outline: 2px solid #edffff;
      outline-offset: 3px;
    }
  }

  &__message {
    display: flex;
    flex: 0 0 auto;
    margin: 0 0 20px;
    padding: 11px 13px;
    align-items: flex-start;
    gap: 9px;
    border: 1px solid rgba(240, 181, 95, 0.28);
    border-radius: 12px;
    color: #ffdca8;
    font-size: 12px;
    line-height: 1.55;
    background: rgba(115, 72, 18, 0.22);
    overflow-wrap: anywhere;

    i {
      display: grid;
      width: 17px;
      height: 17px;
      flex: 0 0 auto;
      place-items: center;
      border: 1px solid rgba(255, 220, 168, 0.62);
      border-radius: 50%;
      font-size: 11px;
      font-style: normal;
      font-weight: 800;
    }
  }

  &__card-foot {
    display: flex;
    flex: 0 0 auto;
    justify-content: space-between;
    gap: 12px;
    color: #64818c;
    font-size: 10px;
    letter-spacing: 0.04em;

    span:last-child {
      color: #7da4a7;
    }
  }
}

@media (min-width: 1200px) {
  .swp-login__brand {
    bottom: clamp(52px, 9vh, 110px);
  }
}

@media (min-width: 769px) and (max-width: 1199px) {
  .swp-login {
    &__scene {
      object-position: 32% center;
    }

    &__brand {
      left: 38px;
      bottom: 42px;
      max-width: min(450px, 42vw);

      h1 {
        font-size: clamp(28px, 3.2vw, 42px);
      }

      &-points {
        margin-top: 20px;
      }
    }

    &__rail {
      top: 24px;
      right: 24px;
      bottom: 24px;
      width: min(100% - 48px, 460px);
      max-height: calc(100dvh - 48px);
    }

    &__card {
      padding: 26px 28px 22px;
      border-radius: 24px;
    }

    &__content {
      padding-top: 32px;
      padding-bottom: 26px;
    }
  }
}

@media (max-width: 768px) {
  .swp-login {
    display: block;

    &__scene {
      height: 48%;
      object-position: 42% top;
      filter: saturate(0.88);
    }

    &__shade {
      background: linear-gradient(
        180deg,
        rgba(3, 13, 21, 0.1) 0%,
        rgba(3, 13, 21, 0.04) 26%,
        rgba(3, 13, 21, 0.9) 69%,
        #06141c 100%
      );
      box-shadow: none;
    }

    &::after {
      background: linear-gradient(
        180deg,
        transparent 25%,
        rgba(2, 11, 17, 0.34) 56%,
        rgba(2, 11, 17, 0.76)
      );
    }

    &__brand {
      top: 26px;
      right: 22px;
      bottom: auto;
      left: 22px;
      max-width: none;
      padding-left: 14px;

      &::before {
        height: 42px;
      }

      &-mark {
        width: 36px;
        height: 36px;
        margin-bottom: 12px;
        border-radius: 11px;
        font-size: 16px;
      }

      &-kicker {
        margin-bottom: 8px !important;
        font-size: 10px;
      }

      h1 {
        font-size: clamp(24px, 7vw, 32px);
      }

      > p:not(.swp-login__brand-kicker) {
        margin-top: 9px;
        font-size: 12px;
      }

      &-points {
        gap: 6px;
        margin-top: 15px;

        span {
          height: 24px;
          padding: 0 9px;
          font-size: 10px;
        }
      }
    }

    &__rail {
      top: auto;
      right: 0;
      bottom: 0;
      left: 0;
      width: 100%;
      max-height: min(78dvh, 680px);
      margin: 0;
      align-items: stretch;
      justify-content: flex-end;
    }

    &__card {
      max-height: 100%;
      padding: 22px 22px calc(16px + env(safe-area-inset-bottom));
      border-right: 0;
      border-bottom: 0;
      border-left: 0;
      border-radius: 26px 26px 0 0;
      box-shadow:
        0 -22px 54px rgba(0, 0, 0, 0.32),
        0 0 0 1px rgba(255, 255, 255, 0.025) inset,
        0 0 42px rgba(64, 206, 200, 0.08) inset;
    }

    &__card-head {
      padding-bottom: 17px;
    }

    &__content {
      justify-content: flex-start;
      padding: 24px 0 20px;

      h2 {
        font-size: 25px;
      }
    }

    &__form {
      gap: 15px;
      margin-top: 23px;
    }

    &__roles {
      max-height: min(220px, 31vh);
      margin-top: 21px;
    }

    &__message {
      margin-bottom: 15px;
    }
  }
}

@media (max-width: 420px) {
  .swp-login {
    &__brand {
      top: 20px;
      left: 18px;

      h1 {
        font-size: 23px;
      }

      &-points {
        display: none;
      }
    }

    &__card {
      padding-right: 18px;
      padding-left: 18px;
    }

    &__card-head {
      gap: 10px;
    }

    &__secure {
      font-size: 10px;
    }

    &__content {
      padding-top: 21px;
      padding-bottom: 15px;
    }

    &__field input {
      height: 48px;
    }

    &__submit {
      min-height: 48px;
    }
  }
}

@media (max-height: 720px) and (min-width: 769px) {
  .swp-login {
    &__rail {
      top: 16px;
      bottom: 16px;
      max-height: calc(100dvh - 32px);
    }

    &__card {
      padding-top: 20px;
      padding-bottom: 17px;
    }

    &__card-head {
      padding-bottom: 15px;
    }

    &__content {
      padding-top: 22px;
      padding-bottom: 18px;
    }

    &__form {
      gap: 13px;
      margin-top: 20px;
    }

    &__field input {
      height: 46px;
    }

    &__roles {
      max-height: 220px;
      margin-top: 18px;
    }

    &__brand {
      bottom: 26px;

      &-points {
        display: none;
      }
    }
  }
}

@media (max-height: 600px) and (max-width: 768px) {
  .swp-login {
    &__scene {
      height: 40%;
    }

    &__brand {
      top: 15px;

      &-mark {
        display: none;
      }

      &-kicker {
        margin-bottom: 5px !important;
      }
    }

    &__rail {
      max-height: 84dvh;
    }

    &__card {
      padding-top: 15px;
    }

    &__content {
      padding-top: 16px;
      padding-bottom: 12px;
    }
  }
}

/* 数字孪生氛围层：保持背景可读，同时用低频动效强化空间感 */
.swp-login {
  &__tech-grid {
    position: absolute;
    z-index: 1;
    inset: 0;
    pointer-events: none;
    opacity: 0.28;
    background-image:
      linear-gradient(
        90deg,
        rgba(111, 235, 230, 0.14) 1px,
        transparent 1px
      ),
      linear-gradient(
        180deg,
        rgba(111, 235, 230, 0.1) 1px,
        transparent 1px
      ),
      radial-gradient(
        circle at 52% 40%,
        rgba(79, 219, 212, 0.17),
        transparent 34%
      );
    background-size: 92px 92px, 92px 92px, 100% 100%;
    mask-image: linear-gradient(
      90deg,
      rgba(0, 0, 0, 0.96),
      rgba(0, 0, 0, 0.68) 58%,
      transparent 94%
    );
    animation: login-grid-drift 28s linear infinite;
  }

  &__scanline {
    position: absolute;
    z-index: 2;
    top: -30%;
    left: -12%;
    width: 124%;
    height: 24%;
    pointer-events: none;
    opacity: 0.22;
    background: linear-gradient(
      180deg,
      transparent,
      rgba(135, 255, 242, 0.34) 48%,
      transparent
    );
    filter: blur(1px);
    transform: skewY(-4deg);
    animation: login-scan 11s ease-in-out infinite;
  }

  &__signal {
    position: absolute;
    z-index: 2;
    width: clamp(110px, 13vw, 190px);
    aspect-ratio: 1;
    pointer-events: none;
    border: 1px solid rgba(111, 235, 230, 0.2);
    border-radius: 50%;
    opacity: 0.52;
    background: radial-gradient(
      circle,
      rgba(88, 229, 217, 0.14),
      transparent 62%
    );
    box-shadow:
      0 0 32px rgba(83, 221, 213, 0.12),
      inset 0 0 26px rgba(83, 221, 213, 0.08);
    animation: login-signal-pulse 7s ease-in-out infinite;

    &::before,
    &::after {
      position: absolute;
      inset: 15%;
      border: 1px solid rgba(111, 235, 230, 0.16);
      border-radius: inherit;
      content: "";
    }

    &::after {
      inset: 47%;
      border: 0;
      background: #8af7ec;
      box-shadow: 0 0 16px rgba(138, 247, 236, 0.9);
    }

    &--left {
      top: 15%;
      left: 7%;
    }

    &--right {
      right: 38%;
      bottom: 12%;
      width: clamp(86px, 9vw, 132px);
      animation-delay: -3.5s;
    }
  }

  &__card {
    position: relative;
    isolation: isolate;
    overflow-x: hidden;

    &::after {
      position: absolute;
      z-index: 0;
      top: -45%;
      left: -80%;
      width: 58%;
      height: 190%;
      pointer-events: none;
      content: "";
      background: linear-gradient(
        105deg,
        transparent 0%,
        rgba(154, 255, 243, 0.03) 36%,
        rgba(154, 255, 243, 0.18) 50%,
        rgba(154, 255, 243, 0.03) 64%,
        transparent 100%
      );
      transform: rotate(12deg);
      animation: login-card-sweep 9s ease-in-out infinite;
    }

    > * {
      position: relative;
      z-index: 1;
    }
  }

  &__brand-mark {
    animation: login-mark-pulse 5.5s ease-in-out infinite;
  }

  &__secure i {
    animation: login-status-blink 2.8s ease-in-out infinite;
  }

  &__submit {
    position: relative;
    overflow: hidden;

    &::after {
      position: absolute;
      top: 0;
      left: -45%;
      width: 32%;
      height: 100%;
      pointer-events: none;
      content: "";
      background: linear-gradient(
        100deg,
        transparent,
        rgba(255, 255, 255, 0.48),
        transparent
      );
      transform: skewX(-18deg);
      animation: login-button-sweep 5.5s ease-in-out infinite;
    }

    > * {
      position: relative;
      z-index: 1;
    }
  }
}

@keyframes login-grid-drift {
  from {
    background-position: 0 0, 0 0, 0 0;
  }

  to {
    background-position: 92px 46px, -46px 92px, 0 0;
  }
}

@keyframes login-scan {
  0%,
  100% {
    transform: translate3d(0, -12%, 0) skewY(-4deg);
    opacity: 0;
  }

  18%,
  74% {
    opacity: 0.22;
  }

  58% {
    transform: translate3d(0, 470%, 0) skewY(-4deg);
    opacity: 0.34;
  }
}

@keyframes login-signal-pulse {
  0%,
  100% {
    opacity: 0.28;
    transform: scale(0.94);
  }

  50% {
    opacity: 0.62;
    transform: scale(1);
  }
}

@keyframes login-card-sweep {
  0%,
  18% {
    transform: translate3d(0, 0, 0) rotate(12deg);
    opacity: 0;
  }

  36%,
  68% {
    opacity: 1;
  }

  82%,
  100% {
    transform: translate3d(340%, 0, 0) rotate(12deg);
    opacity: 0;
  }
}

@keyframes login-button-sweep {
  0%,
  55%,
  100% {
    transform: translateX(0) skewX(-18deg);
    opacity: 0;
  }

  66% {
    transform: translateX(410%) skewX(-18deg);
    opacity: 1;
  }
}

@keyframes login-mark-pulse {
  0%,
  100% {
    box-shadow:
      0 10px 24px rgba(0, 0, 0, 0.18),
      0 0 28px rgba(79, 210, 205, 0.14) inset;
  }

  50% {
    box-shadow:
      0 12px 28px rgba(0, 0, 0, 0.22),
      0 0 36px rgba(79, 210, 205, 0.3) inset,
      0 0 18px rgba(79, 210, 205, 0.2);
  }
}

@keyframes login-status-blink {
  0%,
  100% {
    opacity: 0.62;
    transform: scale(0.92);
  }

  50% {
    opacity: 1;
    transform: scale(1.15);
  }
}

@media (max-width: 768px) {
  .swp-login {
    &__tech-grid {
      opacity: 0.2;
      background-size: 68px 68px, 68px 68px, 100% 100%;
      mask-image: linear-gradient(
        180deg,
        rgba(0, 0, 0, 0.92),
        rgba(0, 0, 0, 0.48) 68%,
        transparent 100%
      );
    }

    &__scanline {
      height: 18%;
      animation-duration: 13s;
    }

    &__signal {
      opacity: 0.34;

      &--left {
        top: 12%;
        left: -26px;
      }

      &--right {
        right: -30px;
        bottom: 34%;
      }
    }
  }
}

/* 结构化登录卡片：把账号验证、角色确认和平台能力拆成清晰层级 */
.swp-login {
  --login-warm: #f3c875;
  --login-warm-soft: rgba(243, 200, 117, 0.18);

  &__card {
    background:
      radial-gradient(
        circle at 92% 7%,
        rgba(96, 222, 211, 0.1),
        transparent 28%
      ),
      radial-gradient(
        circle at 4% 92%,
        rgba(243, 200, 117, 0.06),
        transparent 25%
      ),
      linear-gradient(145deg, rgba(21, 66, 78, 0.28), transparent 46%),
      var(--login-panel);
    box-shadow:
      -28px 28px 70px rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(255, 255, 255, 0.025) inset,
      0 0 46px rgba(64, 206, 200, 0.1) inset,
      0 0 38px rgba(243, 200, 117, 0.04);
    animation: login-card-breathe 12s ease-in-out infinite;

    &::before {
      position: absolute;
      z-index: 0;
      inset: 10px;
      pointer-events: none;
      border: 1px solid rgba(180, 239, 233, 0.1);
      border-radius: 20px;
      content: "";
      mask-image: linear-gradient(
        135deg,
        #000,
        rgba(0, 0, 0, 0.35) 48%,
        transparent 80%
      );
    }
  }

  &__steps {
    display: flex;
    min-height: 58px;
    margin-top: 10px;
    padding: 10px 12px;
    align-items: center;
    gap: 10px;
    border: 1px solid rgba(163, 225, 229, 0.14);
    border-radius: 16px;
    background: rgba(5, 31, 42, 0.56);
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.018) inset,
      0 8px 20px rgba(1, 14, 22, 0.12);
  }

  &__step {
    display: inline-flex;
    min-width: 0;
    flex: 1 1 0;
    align-items: center;
    gap: 8px;
    color: #6f8994;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    transition:
      color 0.24s ease,
      transform 0.24s ease;

    i {
      display: grid;
      width: 27px;
      height: 27px;
      flex: 0 0 auto;
      place-items: center;
      border: 1px solid rgba(139, 184, 187, 0.22);
      border-radius: 9px;
      color: #79979f;
      font-size: 10px;
      font-style: normal;
      letter-spacing: 0.04em;
      background: rgba(10, 51, 61, 0.48);
      transition:
        border-color 0.24s ease,
        color 0.24s ease,
        background 0.24s ease,
        box-shadow 0.24s ease;
    }

    > span {
      overflow: hidden;
      text-overflow: ellipsis;
    }

    &--active {
      color: #e8ffff;
      transform: translateY(-1px);

      i {
        border-color: rgba(101, 224, 211, 0.66);
        color: #062e34;
        background: var(--login-accent);
        box-shadow: 0 0 16px rgba(101, 224, 211, 0.22);
      }
    }

    &--done {
      color: rgba(214, 245, 239, 0.72);

      i {
        border-color: rgba(243, 200, 117, 0.62);
        color: #2e2a1d;
        background: var(--login-warm);
        box-shadow: 0 0 16px var(--login-warm-soft);
      }
    }
  }

  &__step-line {
    position: relative;
    display: block;
    width: 28px;
    height: 1px;
    flex: 0 0 auto;
    overflow: hidden;
    background: rgba(151, 219, 220, 0.16);

    &::after {
      position: absolute;
      top: 0;
      left: 0;
      width: 45%;
      height: 100%;
      content: "";
      background: linear-gradient(
        90deg,
        transparent,
        rgba(243, 200, 117, 0.78),
        transparent
      );
      animation: login-step-progress 5.5s ease-in-out infinite;
    }
  }

  &__support {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 9px;
    margin-top: 24px;
  }

  &__support-item {
    position: relative;
    display: flex;
    min-width: 0;
    min-height: 76px;
    padding: 11px 10px;
    flex-direction: column;
    align-items: flex-start;
    justify-content: space-between;
    overflow: hidden;
    border: 1px solid rgba(151, 219, 220, 0.16);
    border-radius: 15px;
    background:
      linear-gradient(
        145deg,
        rgba(34, 91, 94, 0.38),
        rgba(7, 34, 45, 0.38)
      );
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.015) inset;
    cursor: default;
    transition:
      border-color 0.22s ease,
      background 0.22s ease,
      transform 0.22s ease;

    &::after {
      position: absolute;
      right: -18px;
      bottom: -28px;
      width: 74px;
      height: 74px;
      border: 1px solid rgba(101, 224, 211, 0.16);
      border-radius: 50%;
      content: "";
    }

    &:hover {
      border-color: rgba(151, 219, 220, 0.38);
      background:
        linear-gradient(
          145deg,
          rgba(42, 111, 110, 0.45),
          rgba(8, 39, 50, 0.48)
        );
      transform: translateY(-2px);
    }

    > i {
      display: grid;
      width: 25px;
      height: 25px;
      place-items: center;
      border: 1px solid rgba(135, 241, 229, 0.34);
      border-radius: 8px;
      color: #d9fffb;
      font-size: 11px;
      font-style: normal;
      font-weight: 700;
      background: rgba(45, 146, 140, 0.34);
      box-shadow: 0 0 14px rgba(101, 224, 211, 0.1);
      animation: login-amber-pulse 6s ease-in-out infinite;
    }

    &:nth-child(2) > i {
      border-color: rgba(243, 200, 117, 0.42);
      color: #fff1c8;
      background: rgba(130, 102, 45, 0.32);
      animation-delay: -2s;
    }

    &:nth-child(3) > i {
      border-color: rgba(170, 168, 255, 0.34);
      color: #e8e7ff;
      background: rgba(89, 82, 160, 0.3);
      animation-delay: -4s;
    }

    > span {
      display: grid;
      min-width: 0;
      gap: 3px;
      margin-top: 8px;
    }

    strong,
    small {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    strong {
      color: #e6ffff;
      font-size: 11px;
      font-weight: 700;
    }

    small {
      color: #78969f;
      font-size: 10px;
    }
  }

  &__heading {
    position: relative;
    padding-left: 2px;

    h2 {
      text-shadow: 0 4px 20px rgba(104, 229, 219, 0.12);
    }
  }

  &__field input {
    background:
      linear-gradient(
        135deg,
        rgba(19, 70, 80, 0.72),
        rgba(8, 34, 47, 0.84)
      ),
      var(--login-field);
  }

  &__submit {
    background:
      linear-gradient(
        135deg,
        #91f4e3 0%,
        #63ded2 56%,
        #49c7c9 100%
      );
    box-shadow:
      0 16px 32px rgba(35, 187, 180, 0.22),
      0 0 26px rgba(101, 224, 211, 0.1),
      0 1px 0 rgba(255, 255, 255, 0.46) inset;

    i {
      border-color: rgba(4, 55, 62, 0.26);
      background: rgba(255, 255, 255, 0.1);
    }
  }

  &__card-foot {
    margin-top: 4px;
    padding-top: 16px;
    border-top: 1px solid rgba(166, 232, 230, 0.1);
  }
}

@keyframes login-card-breathe {
  0%,
  100% {
    box-shadow:
      -28px 28px 70px rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(255, 255, 255, 0.025) inset,
      0 0 46px rgba(64, 206, 200, 0.1) inset,
      0 0 38px rgba(243, 200, 117, 0.04);
  }

  50% {
    box-shadow:
      -30px 30px 76px rgba(0, 0, 0, 0.34),
      0 0 0 1px rgba(255, 255, 255, 0.04) inset,
      0 0 54px rgba(64, 206, 200, 0.15) inset,
      0 0 46px rgba(243, 200, 117, 0.08);
  }
}

@keyframes login-amber-pulse {
  0%,
  100% {
    box-shadow:
      0 0 14px rgba(101, 224, 211, 0.1),
      inset 0 0 0 rgba(243, 200, 117, 0);
  }

  50% {
    box-shadow:
      0 0 18px rgba(101, 224, 211, 0.24),
      inset 0 0 14px rgba(243, 200, 117, 0.12);
  }
}

@keyframes login-step-progress {
  0%,
  18% {
    transform: translateX(-140%);
    opacity: 0;
  }

  42%,
  68% {
    opacity: 1;
  }

  82%,
  100% {
    transform: translateX(340%);
    opacity: 0;
  }
}

@media (max-width: 768px) {
  .swp-login {
    &__steps {
      margin-top: 17px;
      padding: 9px 10px;
      gap: 7px;
    }

    &__step {
      gap: 6px;
      font-size: 10px;

      i {
        width: 24px;
        height: 24px;
        border-radius: 8px;
        font-size: 9px;
      }
    }

    &__step-line {
      width: 18px;
    }

    &__support {
      gap: 6px;
      margin-top: 18px;
    }

    &__support-item {
      min-height: 66px;
      padding: 9px 8px;
      border-radius: 12px;

      > i {
        width: 22px;
        height: 22px;
        border-radius: 7px;
        font-size: 10px;
      }

      strong {
        font-size: 10px;
      }

      small {
        font-size: 9px;
      }
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .swp-login__card,
  .swp-login__step-line::after,
  .swp-login__support-item > i {
    animation: none !important;
  }

  .swp-login__tech-grid,
  .swp-login__scanline,
  .swp-login__signal,
  .swp-login__card::after,
  .swp-login__brand-mark,
  .swp-login__secure i,
  .swp-login__submit::after {
    animation: none !important;
  }

  .swp-login *,
  .swp-login *::before,
  .swp-login *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
</style>
