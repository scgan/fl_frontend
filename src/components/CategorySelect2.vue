<script setup>
import { getCategoryService } from '@/api/collector'
import { ref } from 'vue'

defineProps({
  modelValue: {
    type: [Number, String],
  },
})
const emit = defineEmits(['update:modelValue'])

const options = ref([])

const getCategoryList = async () => {
  const res2 = await getCategoryService()
  console.log(res2)
  // buildTree(res2.data.data)
  // console.log(options)
  //if (res2.data.data !== undefined)
  options.value = res2.data.data
  // console.log(options.value.length)
}
getCategoryList()

// 监听 department_id 的变化
// watch(() => props.department_id, (newVal, oldVal) => {
//   // 当 department_id 发生变化时，调用获取员工列表的方法
//   if (newVal !== oldVal) {
//     getStaffList({department_id:newVal});
//     emit('update:modelValue', null)
//   }
// });
</script>

<template>
  <el-select
    :modelValue="modelValue"
    @update:modelValue="emit('update:modelValue', $event)"
    :data="options"
    placeholder="请选择语料类型"
    allow-create
    filterable
    clearable
    style="width: 200px"
  >
    <el-option
      v-for="staff in options"
      :key="staff.category_id"
      :label="staff.category_name"
      :value="staff.category_id"
    ></el-option>
  </el-select>
</template>
