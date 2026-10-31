// 转换为formdata
export function convertToFormData(obj) {
    const formData = new FormData();
    // console.log(obj)
    for (let key in obj) {
      // 如果值为 null，跳过该字段
      if (obj[key] === null) {
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // 处理文件列表
        if(key === 'file' || key === 'picture') {
          // console.log(obj[key])
          if(Array.isArray(obj[key]))
            for(let i = 0; i < obj[key].length; i++) {
              formData.append(key, obj[key][i].raw || obj[key][i].path);
            }
          else formData.append(key, obj[key]);
        }
        else if(key === 'file_names' || Array.isArray(obj[key])) {
            for(let i = 0; i < obj[key].length; i++) {
              formData.append(key, obj[key][i]);
            }
        }
        else formData.append(key, obj[key]);
      }
    }
    return formData;
}

export function convertDateFormat(dateStr) {
  // 如果日期为空，直接返回空
  if (!dateStr) return '';
  // 创建一个新的Date对象
  const date = new Date(dateStr);

  // 手动调整时区
  date.setHours(date.getHours() - 8);

  // 获取年、月、日、时、分、秒
  const year = date.getFullYear(); // 年份
  const month = (date.getMonth() + 1).toString().padStart(2, '0'); // 月份，+1是因为getMonth()返回的月份是从0开始的
  const day = date.getDate().toString().padStart(2, '0'); // 日
  const hours = date.getHours().toString().padStart(2, '0'); // 小时
  const minutes = date.getMinutes().toString().padStart(2, '0'); // 分钟
  const seconds = date.getSeconds().toString().padStart(2, '0'); // 秒

  // 拼接成新的格式
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function getRoleOptions() {
  // 定义角色映射关系
  const roleMap = {
    0: '未知人员',
    1: '二级管理员',
    2: '数据收集者'
  }
	const options = JSON.parse(localStorage.getItem("roles"));
	const res = options.map(value => ({
			value,
			label: roleMap[value]
		})).filter(item => options.includes(item.value))
	console.log(res)
	return res

}

export const parsingReference = (reference) => {
  reference = reference.trim()
  reference = reference.replace(/^\[[^\]]+\](.*)/, '$1')

  const documentType = (reference.match(/\[([^\]]+)\]/g)?.map((s) => s.slice(1, -1)))[0]
  let author = null
  let title = null
  let source = null
  let publish_time = null
  let enTitle = null
  let zhTitle = null
  let issue = null
  let volume = null
  let translator = null
  switch (documentType) {
    case 'EB/OL': {
      let data = reference.split('.').map((item) => item.trim()).filter(item => item != '')
      let authorInfo = data[0]
      let titleInfo = data[1]
      let dateInfo =  data[2]
      let sourceInfo = data.slice(3,data.length).join('.')
      author = authorInfo
      title = titleInfo.split('[')[0]
      publish_time = saveRun(()=> dateInfo.split('(')[1].slice(0,4))
      source = sourceInfo
      break
    }
    case 'R': {
      let [authorInfo, titleInfo, ohterInfo] = reference.split('.').map((item) => item.trim())
      author = authorInfo
      title = titleInfo.split('[')[0]
      source = saveRun(()=> ohterInfo.split(',')[0].split(':')[1])
      publish_time = saveRun(()=> ohterInfo.split(',')[1])
      break
    }
    case 'J': {
      let [authorInfo, titleInfo, ohterInfo] = reference.split('.').map((item) => item.trim())
      author = authorInfo
      title = saveRun(()=> titleInfo.split('[')[0])
      let [sourceInfo,timeInfo,viInfo] = ohterInfo.split(',')
      source = sourceInfo
      publish_time = timeInfo
      const viRes = getVolumeAndIssue(viInfo)
      volume = viRes[0]
      issue = viRes[1]
      break
    }
    case 'J/OL': {
      let [authorInfo, titleInfo, ohterInfo] = reference.split('.').map((item) => item.trim())
      author = authorInfo
      title = titleInfo.split('[')[0]
      source = saveRun(()=> ohterInfo.split(',')[0])
      publish_time = saveRun(()=> ohterInfo.split(',')[1].split('[')[1].split('-')[0])
      break
    }
    case 'C':
      {
        let [authorInfo, titleInfo, sourceInfo, ohterInfo] = reference
          .split('.')
          .map((item) => item.trim())
        author = authorInfo
        title = titleInfo.split('[')[0]
        source = sourceInfo
        publish_time = saveRun(()=> ohterInfo.split(',')[1].split(':')[0])
      }
      break
    case 'M':
      {
        let data = reference.split('.').map((item) => item.trim()).filter(item => item != '')
        console.log(data);
        let authorInfo = null 
        let titleInfo = null 
        let ohterInfo = null
        if(data.length == 4) {
          authorInfo = data[0]
          titleInfo = data[1]
          translator = data[2].endsWith('，译') ? data[2].splice(data[2].length-2,2) : data[2]
          ohterInfo = data[3]
        } else {
          authorInfo = data[0]
          titleInfo = data[1]
          ohterInfo = data[2]
        }
        author = authorInfo
        title = titleInfo.split('[')[0]
        source = saveRun(()=> ohterInfo.split(':')[0])
        publish_time = saveRun(()=> ohterInfo.split(':')[1].slice(0, 4))
      }
      break
    case 'D':
      {
        let [authorInfo, titleInfo, ohterInfo] = reference.split('.').map((item) => item.trim())
        author = authorInfo
        title = titleInfo.split('[')[0]
        source = saveRun(()=> ohterInfo.split(',')[0])
        publish_time = saveRun(()=> ohterInfo.split(',')[1].slice(0, 4))
      }
      break
    case 'N':
      {
        let [authorInfo, titleInfo, ohterInfo] = reference.split('.').map((item) => item.trim())
        author = authorInfo
        title = titleInfo.split('[')[0]
        source = saveRun(()=> ohterInfo.split(',')[0])
        publish_time = saveRun(()=> ohterInfo.split(',')[1])
      }
      break
    case 'S':
      {
        let [authorInfo, titleInfo] = reference.split('.').map((item) => item.trim())
        author = authorInfo

        const index = titleInfo.lastIndexOf(':')
        if (index != -1) titleInfo = titleInfo.substring(0, index)

        title = titleInfo

        const splitArr = reference.split('.')

        source = saveRun(()=> splitArr[splitArr.length - 2].split(',')[0])
        publish_time = saveRun(()=> splitArr[splitArr.length - 2].split(',')[1])
      }
      break
    case 'P':
      {
        let [authorInfo, titleInfo] = reference.split('.').map((item) => item.trim())
        author = authorInfo

        const index = titleInfo.lastIndexOf(':')
        if (index != -1) titleInfo = titleInfo.substring(0, index)

        title = titleInfo

        const splitArr = reference.split('.')

        publish_time = saveRun(()=> splitArr[splitArr.length - 2].split('-')[0])
      }
      break
    default:
      throw new Error('')
      break
  }
  zhTitle = title
  
  // publish_time = /^\d{4}$/.test(publish_time) ? publish_time : null
  publish_time = publish_time.slice(0,4)

  return {
    documentType,
    author,
    enTitle,
    zhTitle,
    source,
    publish_time,
    issue,
    volume,
    translator
  }
}

const getVolumeAndIssue = (viInfo) => {
  try {
    return [viInfo.split('(')[0],viInfo.match(/\(([^)]+)\)/g)?.map((s) => s.slice(1, -1))[0]]
  }
  catch(error) {
    return [null,null]
  }
}

const saveRun = (fn) => {
  try{
    return fn()
  } 
  catch(error) {
    return null
  }
}