<script setup>
// 图标在本项目里需要显式导入（未配置图标自动导入）
import { QuestionFilled } from '@element-plus/icons-vue'

// MLA 格式样例提示：问号图标 + 悬浮样例，术语出处 / 定义出处各处共用。
// 样例是纯文本展示（不可点击），要改文字只改下面两个数组即可。
defineProps({
  // cn：中文文献样例；en：英文文献样例
  variant: {
    type: String,
    default: 'cn',
  },
})

const mlaSamplesCn = [
  {
    label: '专著（书籍）：',
    text: '王弼, 注. 老子道德经. 四部丛刊本, 中华书局, 1936. 中国哲学书电子化计划, ctext.org/dao-de-jing/zh.',
  },
  {
    label: '期刊文章：',
    text: '李泽厚. “孔子的仁学思想.” 哲学研究, vol. 3, no. 2, 1985, pp. 45-52. 万方数据, https://doi.org/10.3969/j.issn.1000-0216.1985.02.005.',
  },
  {
    label: '学位论文：',
    text: '张三. 先秦儒家仁学思想研究. 2020. 北京大学, 博士学位论文. 万方数据, https://doi.org/10.27345/d.cnki.gbfdu.2020.000123.',
  },
  {
    label: '报纸文章：',
    text: '王五. “传统伦理的现代价值.” 人民日报, 6 May 2021, p. 9. 人民日报图文数据库, https://doi.org/10.3969/j.issn.1671-8399.2021.05.009.',
  },
  {
    label: '会议论文：',
    text: '李四. “兼爱思想的当代阐释.” 中国哲学年会论文集, 中国社会科学出版社, 2019, pp. 112-25. 万方数据, https://doi.org/10.26914/c.cnkihy.2019.012345.',
  },
  {
    label: '网络资源：',
    text: '中共中央, 国务院. “教育强国建设规划纲要（2024—2035年）.” 中华人民共和国教育部网站, 19 Jan. 2025, www.moe.gov.cn.',
  },
]

const mlaSamplesEn = [
  {
    label: 'Book:',
    text: 'Legge, James. The Chinese Classics. Vol. 1, Clarendon Press, 1893. Chinese Text Project, ctext.org/analects/xue-er/en.',
  },
  {
    label: 'Journal Article:',
    text: 'Caldwell, Elizabeth F., et al. “Depicting Dementia: Representations of Cognitive Health and Illness in Ten Picturebooks for Children.” Children’s Literature in Education, vol. 52, no. 1, 2021, pp. 106-31. SpringerLink, https://doi.org/10.1007/s10583-020-09405-w.',
  },
  {
    label: 'Dissertation:',
    text: 'Smith, John. A Study of Pre-Qin Confucian Humaneness. 2020. Harvard University, PhD dissertation. ProQuest Dissertations & Theses Global, https://doi.org/10.xxxx/xxxxx.',
  },
  {
    label: 'Newspaper Article:',
    text: 'Jones, Alice. “The Modern Value of Traditional Ethics.” The New York Times, 6 May 2021, p. A9. ProQuest, https://doi.org/10.xxxx/nytimes.2021.0506.',
  },
  {
    label: 'Conference Paper:',
    text: 'Brown, Peter. “Contemporary Interpretations of Universal Love.” Proceedings of the Annual Meeting of the American Philosophical Association, APA Press, 2019, pp. 45-60. JSTOR, https://doi.org/10.2307/j.ctv1234567.',
  },
  {
    label: 'Web:',
    text: 'Ministry of Education of the PRC. “Education in China.” Ministry of Education of the People’s Republic of China, 2025, en.moe.gov.cn.',
  },
]
</script>

<template>
  <el-tooltip placement="top-start" effect="light" :width="520" :show-after="150">
    <template #content>
      <div class="mla-tooltip">
        <div class="mla-tooltip__title">
          {{ variant === 'en' ? 'MLA格式样例（英文文献）' : 'MLA格式样例' }}
        </div>
        <div
          v-for="item in variant === 'en' ? mlaSamplesEn : mlaSamplesCn"
          :key="item.label"
          class="mla-tooltip__item"
        >
          <b>{{ item.label }}</b>{{ variant === 'en' ? ' ' : '' }}{{ item.text }}
        </div>
      </div>
    </template>
    <el-icon class="mla-question"><QuestionFilled /></el-icon>
  </el-tooltip>
</template>

<style scoped>
.mla-question {
  flex-shrink: 0;
  margin-top: 4px;
  font-size: 19px; /* 比正文大一圈，更醒目 */
  color: var(--el-color-primary, #005767);
  cursor: pointer;
  transition:
    color 0.2s,
    transform 0.2s;
}

.mla-question:hover {
  color: var(--el-color-primary-light-3, #66a0ac);
  transform: scale(1.15);
}

.mla-tooltip__title {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 700;
}

.mla-tooltip__item {
  margin-bottom: 8px;
  line-height: 1.7;
  word-break: break-word; /* 样例里的 doi/网址较长时换行，不撑破提示框 */
}

.mla-tooltip__item:last-child {
  margin-bottom: 0;
}
</style>
