<template>
  <Alert
    v-if="showSpecNotFound"
    v-model="showSpecNotFound"
    status="error"
    :title="t('specPage.noSpecError.title')"
    class="mb-16px"
    :icon="WarningIcon"
    dismissible
  >
    <p class="mb-24px">
      {{ t('specPage.noSpecError.intro') }} <InlineCodeFragment variant="error">
        {{ route.params.unrunnable }}
      </InlineCodeFragment>
    </p>
    <p>{{ t('specPage.noSpecError.explainer') }}</p>
  </Alert>
  <Alert
    v-else-if="showOffline"
    v-model="showOffline"
    data-cy="offline-alert"
    status="warning"
    :title="t('specPage.offlineWarning.title')"
    class="mb-16px"
    :icon="WarningIcon"
    dismissible
  >
    <p class="mb-24px">
      {{ t('specPage.offlineWarning.explainer') }}
    </p>
  </Alert>
  <Alert
    v-else-if="showFetchError"
    v-model="showFetchError"
    status="warning"
    :title="t('specPage.fetchFailedWarning.title')"
    class="mb-16px"
    :icon="WarningIcon"
    dismissible
  >
    <p>
      {{ t('specPage.fetchFailedWarning.explainer1') }}
    </p>
    <p>
      <i18n-t
        scope="global"
        keypath="specPage.fetchFailedWarning.explainer2"
      >
        <ExternalLink
          href="https://www.cypressstatus.com"
          class="font-medium text-indigo-500 contents group-hocus:text-indigo-600"
        >
          Status Page
        </ExternalLink>
      </i18n-t>
    </p>
    <Button
      :prefix-icon="RefreshIcon"
      class="mt-24px"
      data-cy="refresh-button"
      @click="emit('refetchFailedCloudData')"
    >
      {{ t('specPage.fetchFailedWarning.refreshButton') }}
    </Button>
  </Alert>
  <Alert
    v-else-if="showProjectNotFound"
    v-model="showProjectNotFound"
    data-cy="project-not-found-alert"
    status="warning"
    :title="t('runs.errors.notFound.title')"
    class="mb-16px"
    :icon="WarningIcon"
    dismissible
  >
    <p class="mb-24px">
      <i18n-t
        scope="global"
        keypath="runs.errors.notFound.description"
      >
        <CodeTag
          bg
          class="bg-warning-100"
        >
          projectId: "{{ props.gql.currentProject?.projectId }}"
        </CodeTag>
      </i18n-t>
    </p>
    <Button
      :prefix-icon="ConnectIcon"
      class="mt-24px"
      data-cy="reconnect-button"
      @click="loginConnectStore.openLoginConnectModal({utmMedium: 'Tests Tab'})"
    >
      {{ t('runs.errors.notFound.button') }}
    </Button>
  </Alert>
  <Alert
    v-else-if="showProjectRequestAccess"
    v-model="showProjectRequestAccess"
    data-cy="project-request-access-alert"
    status="warning"
    :title="t('specPage.unauthorizedBannerTitle')"
    class="mb-16px"
    :icon="WarningIcon"
    dismissible
  >
    <p class="mb-24px">
      {{ props.hasRequestedAccess ? t('runs.errors.unauthorizedRequested.description') : t('runs.errors.unauthorized.description') }}
    </p>
    <RequestAccessButton :gql="props.gql" />
  </Alert>

  <component
    :is="bannerToShow"
    v-else-if="isBannerAllowed && bannerToShow"
    :has-banner-been-shown="hasCurrentBannerBeenShown"
    :cohort-option="currentCohortOption.cohort"
  />
</template>

<script setup lang="ts">
import Button from '@cy/components/Button.vue'
import ExternalLink from '@cy/gql-components/ExternalLink.vue'
import { useI18n } from '@cy/i18n'
import Alert from '@packages/frontend-shared/src/components/Alert.vue'
import CodeTag from '@packages/frontend-shared/src/components/CodeTag.vue'
import InlineCodeFragment from '@packages/frontend-shared/src/components/InlineCodeFragment.vue'
import ConnectIcon from '~icons/cy/chain-link_x16.svg'
import WarningIcon from '~icons/cy/warning_x16.svg'
import RefreshIcon from '~icons/cy/action-restart_x16'
import { useRoute } from 'vue-router'
import { computed, reactive, ref, watch } from 'vue'
import RequestAccessButton from './RequestAccessButton.vue'
import { gql, useSubscription } from '@urql/vue'
import { SpecsListBannersFragment, SpecsListBanners_CheckCloudOrgMembershipDocument } from '../generated/graphql'
import { AllowedState, BannerIds } from '@packages/types'
import { LoginBanner, CreateOrganizationBanner, ConnectProjectBanner, RecordBanner } from './banners'
import { useLoginConnectStore } from '@packages/frontend-shared/src/store/login-connect-store'
import { usePromptManager } from '@packages/frontend-shared/src/gql-components/composables/usePromptManager'
import { CohortConfig, useCohorts } from '@packages/frontend-shared/src/gql-components/composables/useCohorts'

const route = useRoute()
const { t } = useI18n()
const loginConnectStore = useLoginConnectStore()

gql`
fragment SpecsListBanners on Query {
  ...RequestAccessButton
  cloudViewer {
    id
    firstOrganization: organizations(first: 1) {
      nodes {
        id
      }
    }
  }
  cachedUser {
    id
  }
  currentProject {
    id
    projectId
    savedState
  }
}
`

gql`
subscription SpecsListBanners_CheckCloudOrgMembership {
  cloudViewerChange {
    ...SpecsListBanners
  }
}
`

const props = withDefaults(defineProps<{
  gql: SpecsListBannersFragment
  hasRequestedAccess?: boolean
  isSpecNotFound?: boolean
  isOffline?: boolean
  isFetchError?: boolean
  isProjectNotFound?: boolean
  isProjectUnauthorized?: boolean
}>(), {
  isSpecNotFound: undefined,
  isOffline: undefined,
  isFetchError: undefined,
  isProjectNotFound: undefined,
  isProjectUnauthorized: undefined,
})

const emit = defineEmits<{
  (e: 'refetchFailedCloudData'): void
}>()

useSubscription({ query: SpecsListBanners_CheckCloudOrgMembershipDocument })

const showSpecNotFound = ref(props.isSpecNotFound)
const showOffline = ref(props.isOffline)
const showFetchError = ref(props.isFetchError)
const showProjectNotFound = ref(props.isProjectNotFound)
const showProjectRequestAccess = ref(props.isProjectUnauthorized)

const isBannerAllowed = ref(false)

const bannerIds = {
  isLoggedOut: BannerIds.ACI_082022_LOGIN,
  needsOrgConnect: BannerIds.ACI_082022_CREATE_ORG,
  needsProjectConnect: BannerIds.ACI_082022_CONNECT_PROJECT,
  needsRecordedRun: BannerIds.ACI_082022_RECORD,
} as const

watch(
  () => ([props.isSpecNotFound, props.isOffline, props.isFetchError, props.isProjectNotFound, props.isProjectUnauthorized]),
  () => {
    showSpecNotFound.value = props.isSpecNotFound
    showOffline.value = props.isOffline
    showFetchError.value = props.isFetchError
    showProjectNotFound.value = props.isProjectNotFound
    showProjectRequestAccess.value = props.isProjectUnauthorized
  },
)

const cloudData = computed(() => ([props.gql.cloudViewer, props.gql.cachedUser, props.gql.currentProject] as const))
const bannerToShow = computed(() => {
  const componentsByStatus = {
    isLoggedOut: LoginBanner,
    needsOrgConnect: CreateOrganizationBanner,
    needsProjectConnect: ConnectProjectBanner,
    needsRecordedRun: RecordBanner,
  }

  return componentsByStatus[loginConnectStore.userStatus] ?? null
})

const hasCurrentBannerBeenShown = computed(() => {
  const bannersState = (props.gql.currentProject?.savedState as AllowedState)?.banners

  return !!bannersState?._disabled || !!bannersState?.[bannerIds[loginConnectStore.userStatus]]?.lastShown
})

const { isAllowedFeature } = usePromptManager()

watch(cloudData, () => {
  // when cloud data updates, recheck if banner is allowed
  isBannerAllowed.value = isAllowedFeature('specsListBanner')
},
{ immediate: true })

const bannerCohortOptions = {
  [BannerIds.ACI_082022_LOGIN]: [
    { cohort: 'A', value: t('specPage.banners.login.contentA') },
    { cohort: 'B', value: t('specPage.banners.login.contentB') },
  ],
  [BannerIds.ACI_082022_CREATE_ORG]: [
    { cohort: 'A', value: t('specPage.banners.createOrganization.titleA') },
    { cohort: 'B', value: t('specPage.banners.createOrganization.titleB') },
  ],
  [BannerIds.ACI_082022_CONNECT_PROJECT]: [
    { cohort: 'A', value: t('specPage.banners.connectProject.contentA') },
    { cohort: 'B', value: t('specPage.banners.connectProject.contentB') },
  ],
}

const cohortBuilder = useCohorts()

const getCohortForBanner = (bannerId: string) => {
  const cohortConfig: CohortConfig = {
    name: bannerId,
    options: bannerCohortOptions[bannerId],
  }

  return cohortBuilder.getCohort(cohortConfig)
}

const currentCohortOption = computed(() => {
  if (!bannerCohortOptions[bannerIds[loginConnectStore.userStatus]]) {
    return { cohort: null }
  }

  return reactive({ cohort: getCohortForBanner(bannerIds[loginConnectStore.userStatus]) })
})

</script>
