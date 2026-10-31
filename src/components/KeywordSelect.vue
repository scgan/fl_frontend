<script setup>
import { getKeywordService } from '@/api/collector'
import { ref,useTemplateRef } from 'vue'

const inputRef = useTemplateRef('inputRef')

const props = defineProps({
  modelValue: {
    type: [Number, String, Array],
  },
  language: {
    type: Number,
  },
})
const emit = defineEmits(['update:modelValue'])

const options = ref([])

const getKeywordList = async () => {
  const res2 = await getKeywordService({ page_size: 1000, language: props.language })
  // buildTree(res2.data.data)
  // console.log(options)
  //if (res2.data.data !== undefined)
  options.value = res2.data.data.data
  filteredOptions.value = options.value
  // console.log(options.value.length)
}
getKeywordList()

const handleInput = (value) => {
  let localValue = props.modelValue
  // 处理删减情况
  if (localValue === null || localValue === undefined) localValue = []
  if (value.length < localValue.length) {
    emit('update:modelValue', value)
    return
  }
  // 如果输入的是字符串，按多种分隔符分隔
  if (typeof value[value.length - 1] === 'string') {
    // 使用正则表达式匹配分号、逗号、顿号等
    const separators = /[;,、，；]/ // 分隔符列表
    const keywords = value[value.length - 1]
      .split(separators)
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword !== '')
    // console.log(keywords)
    if (localValue === null) localValue = keywords
    else {
      localValue.push(...keywords)
    }
    emit('update:modelValue', localValue)
  }
}

const handleBlur = () => {
  let localValue = props.modelValue
  // 处理删减情况
  if (localValue === null || localValue === undefined) localValue = []
  const inputEl = inputRef.value.$el.querySelector('.el-select__input');
  // const inputEl = document.querySelector('.el-select__input');
  // el-select 内部 input 在 $refs.input 或 $refs.reference 里
  // const inputEl = selectRef.value?.$refs?.input || selectRef.value?.$refs?.reference?.$el?.querySelector('input')
  if (!inputEl) return;

  const inputValue = inputEl.value.trim();
  if (inputValue) {
    localValue.push(inputValue);
    emit('update:modelValue', localValue)
  }
};

const filteredOptions = ref([])
const handleFilter = (keyword) => {
  if (!keyword) {
    filteredOptions.value = options.value // 限制初始数量
  } else {
    filteredOptions.value = options.value.filter(item =>
      item.keyword.toLowerCase().includes(keyword.toLowerCase())
    )
    // 把用户输入作为第一项插入
    const userInputOption = {
      keyword,
      label: keyword,
      value: keyword, // 你也可以自定义 value，比如 `__user__${keyword}`
      keyword: keyword,
      isUserInput: true,
    }
    filteredOptions.value.unshift(userInputOption)
  }
}
</script>

<template>
  <el-select
    id="mySelect"
    :modelValue="modelValue"
    @update:modelValue="emit('update:modelValue', $event)"
    :data="options"
    placeholder="请选择关键词或者自行录入，录入完毕点击回车键确认录入信息"
    allow-create
    filterable
    default-first-option
    :reserve-keyword="false"
    :filter-method="handleFilter"
    clearable
    style="width: 100%"
    @change="handleInput"
    multiple
    @blur="handleBlur"
    ref="inputRef"
  >
  <!-- 封印  @blur="handleBlur" -->
    <el-option
      v-for="staff in filteredOptions"
      :key="staff.keyword_id"
      :label="staff.keyword"
      :value="staff.keyword"
    ></el-option>
  </el-select>
</template>
