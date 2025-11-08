const API = "http://localhost:8000/api"
const { createApp } = Vue

createApp({
  data: () => ({
    userId: localStorage.userId || "",
    tempId: "",
    projects: [],
    project: null,
    tasks: [],
    darkMode: localStorage.dark === "1",
    search: "",
    showQR: false,
    columns: [
      { id: "todo", title: "To Do" },
      { id: "progress", title: "In Progress" },
      { id: "done", title: "Done" }
    ]
  }),
  methods: {
    async login() {
      this.userId = this.tempId || prompt("MAX ID")
      localStorage.userId = this.userId
      await this.loadProjects()
    },
    async loadProjects() {
      const r = await fetch(`${API}/projects?user_id=${this.userId}`)
      this.projects = (await r.json()).projects || []
    },
    async createProject() {
      const title = prompt("Название")
      await fetch(`${API}/projects?title=${title}&user_id=${this.userId}`, {method: "POST"})
      await this.loadProjects()
    },
    openProject(p) {
      this.project = p
      this.loadTasks()
    },
    async loadTasks() {
      const r = await fetch(`${API}/tasks/${this.project.hash}?user_id=${this.userId}`)
      this.tasks = (await r.json()).tasks || []
    },
    toggleDark() {
      this.darkMode = !this.darkMode
      localStorage.dark = this.darkMode ? "1" : "0"
    }
  },
  directives: {
    sortable: {
      mounted(el) {
        new Sortable(el, {
          group: "tasks",
          animation: 150,
          onEnd: () => console.log("Перетащено")
        })
      }
    }
  },
  watch: {
    showQR(v) {
      if (v) setTimeout(() => new QRCode("qrcode", { text: location.href }), 100)
    }
  }
}).mount('#app')
