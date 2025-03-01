<template>
  <div
    v-bind="containerProps"
    class="pt-8px specs-list-container"
    data-cy="specs-list-container"
  >
    <ul
      v-bind="wrapperProps"
      class="children:h-30px"
    >
      <li
        v-for="row in list"
        :key="row.index"
        class="
        cursor-pointer
        flex
        group
        relative"
        data-cy="spec-row-item"
        :data-selected-spec="isCurrentSpec(row.data)"
        @click.self="submit(row.data, row.index)"
      >
        <RouterLink
          :ref="el => setItemRef(el, row.index)"
          :key="row.data.data?.absolute"
          :tabindex="isTabbable(row, row.index) ? '0' : '-1'"
          :style="{ paddingLeft: `${(row.data.depth - 2) * 10 + 16}px` }"
          class="border-transparent outline-none border-1 w-full group focus-visible:bg-gray-900 before:(border-r-4 border-transparent h-28px rounded-r-4px absolute left-[-4px] w-8px) "
          :class="{
            'before:border-r-indigo-300': isCurrentSpec(row.data),
            'before:focus:border-r-indigo-300 before:focus-visible:border-r-transparent before:hover:border-r-indigo-300': !isCurrentSpec(row.data)
          }"
          :to="{ path: '/specs/runner', query: { file: row.data.data?.relative?.replace(/\\/g, '/') } }"
          @focus="resetFocusIfNecessary(row, row.index)"
          @click.capture.prevent="submit(row.data, row.index)"
          @keydown.enter.space.prevent.stop="submit(row.data, row.index)"
          @keydown.left.right.prevent.stop="toggle(row.data, row.index)"
        >
          <SpecFileItem
            v-if="row.data.isLeaf"
            :file-name="row.data.data?.fileName || row.data.name"
            :extension="row.data.data?.specFileExtension || ''"
            :selected="isCurrentSpec(row.data)"
            :indexes="row.data.highlightIndexes"
            class="pl-22px"
            data-cy="spec-file-item"
          />
          <DirectoryItem
            v-else
            class="children:truncate"
            :name="row.data.name"
            :expanded="treeSpecList[row.index].expanded.value"
            :indexes="row.data.highlightIndexes"
            data-cy="directory-item"
          >
            <template #run-all-specs>
              <InlineRunAllSpecs
                v-if="isRunAllSpecsAllowed"
                data-cy="run-all-specs"
                :directory="row.data.name"
                class="opacity-0 run-all"
                :spec-number="directoryChildren[row.data.id].length"
                @runAllSpecs="onRunAllSpecs(row.data.id)"
              />
            </template>
          </DirectoryItem>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { UseCollapsibleTreeNode, useCollapsibleTree, SpecTreeNode, FuzzyFoundSpec, buildSpecTree } from './tree/useCollapsibleTree'
import SpecFileItem from './SpecFileItem.vue'
import { computed, watch, onMounted } from 'vue'
import DirectoryItem from './DirectoryItem.vue'
import { RouterLink, useRouter } from 'vue-router'
import { useSpecStore } from '../store'
import { useVirtualList } from './tree/useVirtualList'
import { useVirtualListNavigation } from './tree/useVirtualListNavigation'
import { useStudioStore } from '../store/studio-store'
import InlineRunAllSpecs from './InlineRunAllSpecs.vue'
import { useRunAllSpecs } from '../composables/useRunAllSpecs'

const props = defineProps<{
  specs: FuzzyFoundSpec[]
}>()

const router = useRouter()

const specStore = useSpecStore()

const isCurrentSpec = (row: UseCollapsibleTreeNode<SpecTreeNode<FuzzyFoundSpec>>) => {
  if (!row.isLeaf || !row.data) {
    return false
  }

  return row.data.relative === specStore.activeSpec?.relative
}

const collapsible = computed(() => useCollapsibleTree(buildSpecTree<FuzzyFoundSpec>(props.specs), { dropRoot: true }))
const treeSpecList = computed(() => collapsible.value.tree.filter(((item) => !item.hidden.value)))

const findCurrentSpecIndex = computed(() => {
  return treeSpecList.value.findIndex((s) => isCurrentSpec(s))
})

const hasAnyCurrentSpec = computed(() => {
  return findCurrentSpecIndex.value > -1
})

const isTabbable = (row, index) => {
  if (!hasAnyCurrentSpec.value) {
    if (index === 0) return true
  } else if (isCurrentSpec(row.data)) {
    return true
  }

  return false
}

const toggle = (row: UseCollapsibleTreeNode<SpecTreeNode<FuzzyFoundSpec>>, idx: number) => {
  activeItem.value = idx
  row.toggle()
}

const submit = (row: UseCollapsibleTreeNode<SpecTreeNode<FuzzyFoundSpec>>, idx: number) => {
  // If the user selects a new spec while in studio mode, turn studio mode off
  const studioStore = useStudioStore()

  studioStore.cancel()

  activeItem.value = idx

  if (row.isLeaf) {
    if (!row.data) {
      return
    }

    router.push({ path: '/specs/runner', query: { file: row.data.relative.replace(/\\/g, '/') } })
  } else {
    row.toggle()
  }

  return false
}

const { containerProps, list, wrapperProps, scrollTo, api } = useVirtualList(treeSpecList, { itemHeight: 30, overscan: 15 })
const { activeItem, setItemRef } = useVirtualListNavigation(api)

onMounted(() => {
  activeItem.value = findCurrentSpecIndex.value
})

// If you are scrolled down the virtual list and list changes,
// reset scroll position to top of list
watch(collapsible, () => {
  activeItem.value = null
  scrollTo(0)
})

const resetFocusIfNecessary = (row, index) => {
  if (isTabbable(row, index)) {
    activeItem.value = index
  }
}

const { runAllSpecs, isRunAllSpecsAllowed, directoryChildren } = useRunAllSpecs(collapsible)

function onRunAllSpecs (rowId: string) {
  runAllSpecs(directoryChildren.value[rowId])
}

</script>

<style scoped>
a::before {
  content: "";
}

/** h-[calc] was getting dropped so moved to styles. Virtual list requires defined height. */
/** Header is 64px, padding-top is 8px **/
.specs-list-container {
  height: calc(100vh - 64px - 8px);
}

/** For run all specs group hover to work */
[data-cy=spec-row-item]:hover .run-all, [data-cy=spec-row-item]:focus-within .run-all {
  opacity: 1 !important;
}

</style>
