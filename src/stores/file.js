import { defineStore } from 'pinia'

export const useFileStore = defineStore('file', {
  state: () => ({
    uploadedFile: null,
  }),
  actions: {
    setUploadedFile(file) {
      this.uploadedFile = file
      //   console.log(file)
    },
    clearUploadedFile() {
      this.uploadedFile = null
    },
  },
})
