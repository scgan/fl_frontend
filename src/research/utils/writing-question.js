/** 根据已确认的写作操作生成自然的用户消息，仅用于展示，保留原始主题、请求参数和阶段衔接。 */

/** 沿前序产物查找真实章节名，支持稿件多次修改，并在缺少旧产物时退回章节编号。 */
function sectionName(writing, turns) {
  let artifactId = writing.artifact_id
  let ref = writing.section_ref || ''
  const visited = new Set()
  while (artifactId && !visited.has(artifactId)) {
    visited.add(artifactId)
    const source = turns.find(
      (turn) => turn.result_payload?.payload?.writing_result?.artifact_id === artifactId,
    )
    const result = source?.result_payload?.payload?.writing_result
    if (!result) break
    const options = source.request_payload?.writing || {}
    ref ||= result.section_ref || options.section_ref || ''
    const section = result.sections?.find((item) => item.section_id === ref)
    if (section?.title) return `“${section.title}”这一节`
    artifactId = result.based_on_artifact_id || options.artifact_id
  }
  return ref ? `第 ${ref} 节` : ''
}

/** 保留用户要求中的原文和标点，只在句末缺少结束符时补上句号。 */
function sentence(text) {
  return /[。！？.!?]$/.test(text) ? text : `${text}。`
}

/** 将卡片操作转为完整请求；手工输入、待确认问题和未知阶段原样显示，不修改运行快照。 */
export function writingQuestion(turn, turns = []) {
  const writing = turn.request_payload?.writing
  if (!writing) return turn.query
  const topic = (turn.query || '').trim()
  const source =
    writing.artifact_id &&
    turns.find(
      (item) => item.result_payload?.payload?.writing_result?.artifact_id === writing.artifact_id,
    )
  const basedOnQuestions = source?.result_payload?.payload?.writing_result?.stage === 'RQ'
  let question
  switch (writing.stage) {
    case 'RQ':
      question = `结合知识库里的文献，帮我围绕“${topic}”推荐论文选题，并提出具体的研究问题。`
      break
    case 'PLAN':
      question = basedOnQuestions
        ? `围绕“${topic}”，结合已有研究问题和知识库文献，帮我拟一份论文提纲。`
        : `结合知识库里的文献，帮我为“${topic}”拟一份论文提纲。`
      break
    case 'THEORY':
      question = `结合知识库里的文献，帮我梳理“${topic}”的理论框架和研究依据。`
      break
    case 'DRAFT':
      question = `按这份提纲，帮我起草${sectionName(writing, turns) || '选定章节'}的正文。`
      break
    case 'REVISE': {
      const target = writing.source_text
        ? '我提供的原文'
        : writing.artifact_id
          ? sectionName(writing, turns) || '上一版稿件'
          : '这份稿件'
      const instruction = (writing.revise_instruction || '').trim()
      question = instruction
        ? sentence(`请按以下要求修改${target}：${instruction}`)
        : `帮我修改${target}。`
      break
    }
    default:
      return turn.query
  }
  const requirements = (writing.writing_requirements || '').trim()
  return requirements ? `${question}\n补充要求：${requirements}` : question
}
