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

// 当前三个角色权限范围一致，暂时隐藏角色选择；后续区分权限时改为 true。
const ENABLE_ROLE_SELECTION = false;

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
    password.value = "";

    if (!ENABLE_ROLE_SELECTION) {
      selectedRoleId.value = String(user.roleList[0].id);
      await submitRole();
      return;
    }

    selectedRoleId.value = "";
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

  if (!ENABLE_ROLE_SELECTION) {
    selectedRoleId.value = String(pending.user.roleList[0].id);
    void submitRole();
    return;
  }

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

    <div class="swp-login__masthead" aria-hidden="true">
      <span>智慧病房 <b>/</b> DIGITAL TWIN</span>
      <span class="swp-login__masthead-line" />
      <span>三维可视化 · 护理协同</span>
    </div>

    <section class="swp-login__brand" aria-label="系统名称">
      <div class="swp-login__brand-mark" aria-hidden="true">
        <span>智</span>
      </div>
      <p class="swp-login__brand-kicker">SMART WARD · DIGITAL TWIN</p>
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

        <div class="swp-login__spatial" aria-hidden="true">
          <div class="swp-login__orbit">
            <div class="swp-login__cube"><i /><i /><i /></div>
          </div>
          <div class="swp-login__spatial-copy">
            <span>连接物理空间与数字世界</span>
            <strong>全域感知 · 三维呈现</strong>
            <div class="swp-login__spatial-line"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
          </div>
        </div>

        <nav v-if="ENABLE_ROLE_SELECTION" class="swp-login__steps" aria-label="登录流程">
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
          <b
            v-if="ENABLE_ROLE_SELECTION"
            class="swp-login__step-line"
            aria-hidden="true"
          />
          <span
            v-if="ENABLE_ROLE_SELECTION"
            class="swp-login__step"
            :class="{ 'swp-login__step--active': step === 'role' }"
          >
            <i>02</i>
            <span>角色确认</span>
          </span>
        </nav>

        <div v-if="step === 'credentials'" class="swp-login__content">
          <div class="swp-login__heading">
            <span class="swp-login__eyebrow">工作空间 / WORKSPACE</span>
            <h2>进入智慧病房<span class="swp-login__title-accent" aria-hidden="true">.</span></h2>
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

        <div
          v-else-if="ENABLE_ROLE_SELECTION"
          class="swp-login__content swp-login__content--roles"
        >
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

<style scoped lang="scss" src="@/styles/swp-login.scss"></style>
