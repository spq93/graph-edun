import { useCallback, useLayoutEffect, useEffect, useRef, useState } from 'react'
import './App.css'
import './smooth-animations.css'
import './queue-animation.css'
import GraphBlock from './GraphBlock'
import GridBlock from './GridBlock'
import { backupCourses, backupTasks } from './backupCourseSeed'
import FIFOBlock from './FIFOBlock'
import TasksPanel from './TasksPanel'


type Block = {
  id: string
  type: 'title' | 'text' | 'list' | 'code' | 'graph' | 'grid' | 'fifo' | 'question'
  content: string
}

type Slide = {
  id: string
  title: string
  blocks: Block[]
}

type Section = 'theory' | 'visualization' | 'tasks'

type Course = {
  id: string
  title: string
  description: string
  theorySlides: Slide[]
  visualizationSlides: Slide[]
  theoryCompleted: boolean
  tasksCompleted: boolean
}

const FIRST_COURSE_ID = 'course-bfs'

function loadCourses(): Course[] {
  const catalogVersion = 'graph-edu-code-catalog-v7'
  let savedCourses: Course[] = []
  try {
    const saved = localStorage.getItem('graph-edu-courses')
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      if (Array.isArray(parsed)) savedCourses = parsed.filter((item): item is Course =>
        !!item && typeof item === 'object' &&
        typeof (item as Record<string, unknown>).id === 'string' &&
        typeof (item as Record<string, unknown>).title === 'string' &&
        Array.isArray((item as Record<string, unknown>).theorySlides) &&
        Array.isArray((item as Record<string, unknown>).visualizationSlides),
      )
    }
  } catch { /* use the source snapshot */ }

  if (localStorage.getItem(catalogVersion) === 'true' && savedCourses.length > 0) return savedCourses

  // The attached backup is now the source of truth for all standard lessons.
  const graphModesByCourse: Record<string, string> = {
    'course-dfs': 'dfs',
    'course-components': 'components',
    'course-cycles': 'cycles',
    'course-dijkstra': 'dijkstra',
    'course-mst': 'mst',
    'course-bellman-ford': 'bellmanFord',
    'course-floyd-warshall': 'floydWarshall',
  }
  const defaultGrid = JSON.stringify({
    cells: [[1,1,1,1,1,1,1,1],[1,0,0,0,1,0,0,1],[1,0,1,0,1,0,1,1],[1,0,1,0,0,0,0,1],[1,0,0,0,1,1,0,1],[1,1,1,1,1,1,1,1]],
    start: [1,1], viewMode: 'floodFill',
  })
  const seededCourses: Course[] = backupCourses.map((course) => {
    const mode = graphModesByCourse[course.id]
    const transformSlides = (slides: Slide[], isVisualization: boolean) => slides.map(slide => ({
      ...slide,
      blocks: slide.blocks.map(block => {
        if (course.id === 'course-flood-fill' && block.type === 'graph') return { ...block, type: 'grid' as const, content: defaultGrid }
        if (block.type === 'graph' && mode && (isVisualization || /пример|шаг|обход/i.test(slide.title))) {
          try { const data = JSON.parse(block.content || '{}'); return { ...block, content: JSON.stringify({ ...data, viewMode: mode, ...(course.id === 'course-bellman-ford' || course.id === 'course-floyd-warshall' ? { directed: true } : {}) }) } } catch { return block }
        }
        return block
      }),
    }))
    const previousCourse = savedCourses.find((savedCourse) => savedCourse.id === course.id)
    return {
      ...course,
      theorySlides: transformSlides(course.theorySlides, false),
      visualizationSlides: transformSlides(course.visualizationSlides, true),
      theoryCompleted: previousCourse?.theoryCompleted ?? false,
      tasksCompleted: previousCourse?.tasksCompleted ?? false,
    }
  })
  const seededIds = new Set(seededCourses.map((course) => course.id))
  const customCourses = savedCourses.filter((course) => !seededIds.has(course.id))
  const courses = [...seededCourses, ...customCourses]
  localStorage.setItem('graph-edu-courses', JSON.stringify(courses))
  Object.entries(backupTasks).forEach(([courseId, tasks]) => {
    const key = courseId === 'course-bfs' ? 'graph-edu-tasks' : `graph-edu-tasks-${courseId}`
    const progressKey = courseId === 'course-bfs' ? 'graph-edu-task-progress' : `graph-edu-task-progress-${courseId}`
    // If option order changed in the new catalog, preserve the learner's selected answer by its text.
    try {
      const previousTasks = JSON.parse(localStorage.getItem(key) || '[]') as Array<{ id: string; options?: string[] }>
      const previousProgress = JSON.parse(localStorage.getItem(progressKey) || '{}') as Record<string, { selectedIndexes?: number[] }>
      const previousById = new Map(previousTasks.map(task => [task.id, task]))
      for (const task of tasks as Array<{ id: string; options?: string[] }>) {
        const oldTask = previousById.get(task.id)
        const progress = previousProgress[task.id]
        if (!oldTask?.options || !task.options || !progress?.selectedIndexes?.length) continue
        const selectedTexts = progress.selectedIndexes.map(index => oldTask.options?.[index]).filter((value): value is string => typeof value === 'string')
        progress.selectedIndexes = selectedTexts.map(value => task.options?.indexOf(value) ?? -1).filter(index => index >= 0)
      }
      localStorage.setItem(progressKey, JSON.stringify(previousProgress))
    } catch { /* Existing progress may be absent or from an older schema. */ }
    localStorage.setItem(key, JSON.stringify(tasks))
  })
  localStorage.setItem(catalogVersion, 'true')
  localStorage.setItem('graph-edu-code-task-template-v1-added', 'true')
  return courses
}

function isCourseCompleted(course: Course) {
  return course.theoryCompleted && course.tasksCompleted
}

type QuestionData = {
  question: string
  options: string[]
  correctIndex: number
  hint: string
}

function readQuestion(value: string): QuestionData {
  const fallback: QuestionData = {
    question: 'Какое число будет извлечено следующим?',
    options: ['1', '2', '3', '4'],
    correctIndex: 0,
    hint: '',
  }

  try {
    const parsed = JSON.parse(value)
    if (
      parsed &&
      typeof parsed.question === 'string' &&
      Array.isArray(parsed.options) &&
      parsed.options.length >= 2 &&
      parsed.options.every((x: unknown) => typeof x === 'string') &&
      Number.isInteger(parsed.correctIndex) &&
      parsed.correctIndex >= 0 &&
      parsed.correctIndex < parsed.options.length &&
      typeof parsed.hint === 'string'
    ) {
      return parsed
    }
  } catch {}
  return fallback
}

function QuestionEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const data = readQuestion(value)

  function update(changes: Partial<QuestionData>) {
    onChange(JSON.stringify({ ...data, ...changes }))
  }

  function updateOption(index: number, text: string) {
    const options = [...data.options]
    options[index] = text
    update({ options })
  }

  function addOption() {
    update({ options: [...data.options, `Вариант ${data.options.length + 1}`] })
  }

  function removeOption(index: number) {
    if (data.options.length <= 2) return
    const options = data.options.filter((_, i) => i !== index)
    const correctIndex =
      data.correctIndex === index
        ? 0
        : data.correctIndex > index
          ? data.correctIndex - 1
          : data.correctIndex
    update({ options, correctIndex })
  }

  return (
    <div className="question-editor">
      <label>
        Вопрос
        <textarea
          value={data.question}
          onChange={e => update({ question: e.target.value })}
          rows={3}
        />
      </label>

      <div className="question-options-editor">
        <span>Варианты ответа · выбери правильный</span>

        {data.options.map((option, index) => (
          <div className="question-option-row" key={index}>
            <input
              type="radio"
              name="question-correct"
              checked={data.correctIndex === index}
              onChange={() => update({ correctIndex: index })}
              title="Правильный ответ"
            />
            <input
              value={option}
              onChange={e => updateOption(index, e.target.value)}
              aria-label={`Вариант ${index + 1}`}
            />
            <button
              className="question-remove-option"
              disabled={data.options.length <= 2}
              onClick={() => removeOption(index)}
            >
              ×
            </button>
          </div>
        ))}

        <button className="question-add-option" onClick={addOption}>
          + Добавить вариант
        </button>
      </div>

      <label>
        Подсказка или дополнительный текст <span className="optional">(необязательно)</span>
        <textarea
          value={data.hint}
          onChange={e => update({ hint: e.target.value })}
          placeholder="Например: вспомни правило FIFO..."
          rows={3}
        />
      </label>

      <small>Правильный ответ хранится для проверки, но ученику в режиме просмотра не показывается.</small>
    </div>
  )
}

function QuestionBlock({
  value,
  completed = false,
  onCorrectChange,
}: {
  value: string
  completed?: boolean
  onCorrectChange?: (correct: boolean) => void
}) {
  const data = readQuestion(value)
  const [selected, setSelected] = useState<number | null>(
    completed ? data.correctIndex : null,
  )
  const answered = selected !== null
  const correct = selected === data.correctIndex

  useEffect(() => {
    setSelected(completed ? data.correctIndex : null)
  }, [value, completed])

  useEffect(() => {
    if (correct && answered) onCorrectChange?.(true)
  }, [correct, answered])

  return (
    <div className="question-card">
      <span className="question-eyebrow">ПРОВЕРЬ СЕБЯ</span>
      <h3>{data.question}</h3>

      <div className="question-options">
        {data.options.map((option, index) => {
          const isSelected = selected === index
          const className =
            answered && isSelected
              ? correct ? 'question-option selected correct' : 'question-option selected wrong'
              : 'question-option'

          return (
            <button
              key={index}
              className={className}
              disabled={answered}
              onClick={() => setSelected(index)}
            >
              <span className="question-option-letter">
                {String.fromCharCode(65 + index)}
              </span>
              <span>{option}</span>
            </button>
          )
        })}
      </div>

      {answered && (
        <div className={correct ? 'question-result correct' : 'question-result wrong'}>
          {correct ? '✓ Правильно!' : `✗ Неверно. Правильный ответ: ${data.options[data.correctIndex]}`}
        </div>
      )}

      {data.hint.trim() && (
        <div className="question-hint">
          <strong>Подсказка</strong>
          <p>{data.hint}</p>
        </div>
      )}

      {answered && (
        <button className="question-reset" onClick={() => setSelected(null)}>
          Попробовать ещё раз
        </button>
      )}
    </div>
  )
}

type GraphEduBackup = {
  format: 'GraphEdu backup'
  version: 1
  exportedAt: string
  origin: string
  localStorage: Record<string, string>
  sessionStorage: Record<string, string>
}

function downloadGraphEduBackup() {
  const collect = (storage: Storage): Record<string, string> => {
    const result: Record<string, string> = {}
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key !== null) result[key] = storage.getItem(key) ?? ''
    }
    return result
  }
  const backup: GraphEduBackup = {
    format: 'GraphEdu backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    origin: window.location.origin,
    localStorage: collect(window.localStorage),
    sessionStorage: collect(window.sessionStorage),
  }
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `graphed-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function App() {
  const [courses, setCourses] = useState<Course[]>(loadCourses)
  const coursesRef = useRef<Course[]>(courses)
  const courseUndoHistory = useRef<Course[][]>([])
  const [activeCourseId, setActiveCourseId] = useState(courses[0]?.id ?? FIRST_COURSE_ID)
  const [view, setView] = useState<'home' | 'course'>('home')
  const [section, setSection] = useState<Section>('theory')
  const [activeSlideBySection, setActiveSlideBySection] = useState<Record<Section, number>>({
    theory: 0,
    visualization: 0,
    tasks: 0,
  })
  const [editing, setEditing] = useState(false)
  const [correctQuestions, setCorrectQuestions] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('graph-edu-correct-questions')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })
  const [navigationMessage, setNavigationMessage] = useState('')
  const importFileRef = useRef<HTMLInputElement>(null)
  const [backupMessage, setBackupMessage] = useState('')
  const [logsMessage, setLogsMessage] = useState('')

  async function importGraphEduBackup(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as Partial<GraphEduBackup>
      if (!parsed.localStorage || typeof parsed.localStorage !== 'object' || Array.isArray(parsed.localStorage)) {
        throw new Error('В файле нет раздела localStorage. Выбери JSON-файл, экспортированный из GraphEdu.')
      }
      const entries = Object.entries(parsed.localStorage).filter(([key, value]) => key.startsWith('graph-edu-') && typeof value === 'string')
      if (!entries.length) throw new Error('В резервной копии не найдены данные GraphEdu.')
      const approved = window.confirm(`Найдено ключей GraphEdu: ${entries.length}. Текущие данные GraphEdu будут заменены. Перед импортом будет скачана резервная копия текущих данных. Продолжить?`)
      if (!approved) return
      downloadGraphEduBackup()
      for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
        const key = window.localStorage.key(index)
        if (key?.startsWith('graph-edu-')) window.localStorage.removeItem(key)
      }
      entries.forEach(([key, value]) => window.localStorage.setItem(key, value))
      // An explicit user import must remain authoritative; do not replace it with the bundled seed on reload.
      window.localStorage.setItem('graph-edu-code-catalog-v7', 'true')
      setBackupMessage(`Импортировано ключей: ${entries.length}. Перезагружаю приложение…`)
      window.setTimeout(() => window.location.reload(), 350)
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : 'Не удалось импортировать файл.')
    } finally {
      if (importFileRef.current) importFileRef.current.value = ''
    }
  }

  const activeCourse = courses.find((course) => course.id === activeCourseId) ?? courses[0]
  const sectionSlides = section === 'theory'
    ? activeCourse?.theorySlides ?? []
    : section === 'visualization'
      ? activeCourse?.visualizationSlides ?? []
      : []
  const activeSlide = activeSlideBySection[section]
  const slides = sectionSlides
  const slide = slides[activeSlide]
  const isVisualization = section === 'visualization'
  const isTasks = section === 'tasks'
  const isHome = view === 'home'
  const courseCompleted = activeCourse ? isCourseCompleted(activeCourse) : false

  useLayoutEffect(() => {
    const scrollToTop = () => {
      window.scrollTo(0, 0)
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }
    scrollToTop()
    const frame = requestAnimationFrame(scrollToTop)
    return () => cancelAnimationFrame(frame)
  }, [view, section, activeCourseId, activeSlide])

  useEffect(() => {
    localStorage.setItem('graph-edu-courses', JSON.stringify(courses))
  }, [courses])

  useEffect(() => {
    localStorage.setItem('graph-edu-correct-questions', JSON.stringify(correctQuestions))
  }, [correctQuestions])

  // Keep an in-memory history of editor changes so Ctrl+Z can restore deleted
  // lessons, blocks, renamed titles, and other catalog/content edits.
  const commitCourses = useCallback((updater: (current: Course[]) => Course[], recordUndo = true) => {
    const current = coursesRef.current
    const next = updater(current)
    if (recordUndo && editing && JSON.stringify(next) !== JSON.stringify(current)) {
      courseUndoHistory.current.push(JSON.parse(JSON.stringify(current)) as Course[])
      if (courseUndoHistory.current.length > 100) courseUndoHistory.current.shift()
    }
    coursesRef.current = next
    setCourses(next)
  }, [editing])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== 'z') return
      if (!editing || (view === 'course' && section === 'tasks')) return
      const previous = courseUndoHistory.current.pop()
      if (!previous) return
      event.preventDefault()
      coursesRef.current = previous
      setCourses(previous)
      setNavigationMessage('Последнее действие отменено.')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editing, view, section])

  function updateCourse(id: string, changes: Partial<Course>) {
    commitCourses((current) => current.map((course) =>
      course.id === id ? { ...course, ...changes } : course,
    ))
  }

  const handleTasksCompletionChange = useCallback((completed: boolean) => {
    commitCourses((current) => current.map((course) => {
      if (course.id !== activeCourseId || course.tasksCompleted === completed) return course
      return { ...course, tasksCompleted: completed }
    }), false)
  }, [activeCourseId, commitCourses])

  function updateCurrentSlides(updater: (current: Slide[]) => Slide[]) {
    if (!activeCourse) return
    commitCourses((current) => current.map((course) => {
      if (course.id !== activeCourse.id) return course
      if (section === 'theory') {
        return {
          ...course,
          theorySlides: updater(course.theorySlides),
          // Editing course theory requires the learner to confirm it again.
          theoryCompleted: editing ? false : course.theoryCompleted,
        }
      }
      if (section === 'visualization') {
        return { ...course, visualizationSlides: updater(course.visualizationSlides) }
      }
      return course
    }))
  }

  function changeActiveSlide(updater: (current: number) => number) {
    setActiveSlideBySection((current) => ({ ...current, [section]: updater(current[section]) }))
  }

  function addBlock(type: Block['type']) {
    const content: Record<Block['type'], string> = {
      title: 'Новый заголовок',
      text: isVisualization ? 'Опишите, что происходит на этом шаге визуализации...' : 'Напишите здесь текст теории...',
      list: 'Первый пункт\nВторой пункт',
      code: 'для каждой вершины v:\n    если v не посещена:\n        запустить обход из v',
      graph: '',
      grid: JSON.stringify({ cells: [[1,1,1,1,1,1,1,1],[1,0,0,0,1,0,0,1],[1,0,1,0,1,0,1,1],[1,0,1,0,0,0,0,1],[1,0,0,0,1,1,0,1],[1,1,1,1,1,1,1,1]], start: [1,1], viewMode: 'floodFill' }),
      fifo: JSON.stringify({ items: ['1', '2', '3', '4'], speed: 900 }),
      question: JSON.stringify({ question: 'Какое число будет извлечено следующим?', options: ['1', '2', '3', '4'], correctIndex: 0, hint: '' }),
    }
    const block: Block = { id: crypto.randomUUID(), type, content: content[type] }
    updateCurrentSlides((current) => current.map((item, index) =>
      index === activeSlide ? { ...item, blocks: [...item.blocks, block] } : item,
    ))
  }

  function updateBlock(id: string, content: string) {
    updateCurrentSlides((current) => current.map((item, index) =>
      index === activeSlide
        ? { ...item, blocks: item.blocks.map((block) => block.id === id ? { ...block, content } : block) }
        : item,
    ))
  }

  function deleteBlock(id: string) {
    updateCurrentSlides((current) => current.map((item, index) =>
      index === activeSlide ? { ...item, blocks: item.blocks.filter((block) => block.id !== id) } : item,
    ))
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction
    if (!slide || target < 0 || target >= slide.blocks.length) return
    updateCurrentSlides((current) => current.map((item, itemIndex) => {
      if (itemIndex !== activeSlide) return item
      const blocks = [...item.blocks]
      ;[blocks[index], blocks[target]] = [blocks[target], blocks[index]]
      return { ...item, blocks }
    }))
  }

  function createSlide() {
    if (!activeCourse) return
    const newSlide: Slide = {
      id: crypto.randomUUID(),
      title: `${isVisualization ? 'Визуализация' : 'Слайд'} ${slides.length + 1}`,
      blocks: [{ id: crypto.randomUUID(), type: 'title', content: isVisualization ? 'Новая визуализация' : 'Новый слайд' }],
    }
    updateCurrentSlides((current) => [...current, newSlide])
    setActiveSlideBySection((current) => ({ ...current, [section]: slides.length }))
  }

  function deleteSlide() {
    if (slides.length <= 1 || !window.confirm(`Удалить слайд ${activeSlide + 1}?`)) return
    updateCurrentSlides((current) => current.filter((_, index) => index !== activeSlide))
    changeActiveSlide((current) => Math.min(current, slides.length - 2))
  }

  function updateSlideTitle(title: string) {
    updateCurrentSlides((current) => current.map((item, index) =>
      index === activeSlide ? { ...item, title } : item,
    ))
  }

  function previousSlide() {
    changeActiveSlide((current) => Math.max(0, current - 1))
  }

  function nextSlide() {
    if (section === 'theory' && slide && !editing) {
      const questions = slide.blocks.filter((block) => block.type === 'question')
      const allCorrect = questions.length > 0 && questions.every((question) => correctQuestions[question.id])
      if (questions.length > 0 && !allCorrect) {
        setNavigationMessage('Ответь правильно на вопрос, чтобы перейти к следующему слайду.')
        window.setTimeout(() => document.querySelector('.question-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
        return
      }
    }
    setNavigationMessage('')
    changeActiveSlide((current) => Math.min(slides.length - 1, current + 1))
  }

  function selectSection(nextSection: Section) {
    if (nextSection !== 'theory' && activeCourse && !activeCourse.theoryCompleted && !editing) {
      setNavigationMessage('Сначала заверши теорию этого урока.')
      return
    }
    setNavigationMessage('')
    setSection(nextSection)
  }

  function markTheoryCompleted() {
    if (!activeCourse) return
    updateCourse(activeCourse.id, { theoryCompleted: true })
    setNavigationMessage('Теория пройдена! Теперь открой задачи и закрепи материал.')
  }

  function canOpenCourse(index: number) {
    return index === 0 || courses.slice(0, index).every(isCourseCompleted)
  }

  function openCourse(course: Course, index: number) {
    if (!canOpenCourse(index) && !editing) {
      setNavigationMessage('Этот урок пока закрыт. Сначала пройди предыдущий урок.')
      return
    }
    setActiveCourseId(course.id)
    setView('course')
    setSection('theory')
    setActiveSlideBySection({ theory: 0, visualization: 0, tasks: 0 })
    setNavigationMessage('')
  }

  function addCourse() {
    const id = `course-${crypto.randomUUID()}`
    const newCourse: Course = {
      id,
      title: `Новый урок ${courses.length + 1}`,
      description: 'Добавь описание урока и настрой учебные материалы в редакторе.',
      theorySlides: [{
        id: crypto.randomUUID(),
        title: 'Введение',
        blocks: [
          { id: crypto.randomUUID(), type: 'title', content: 'Новый урок' },
          { id: crypto.randomUUID(), type: 'text', content: 'Добавь сюда теорию, примеры и объяснения.' },
        ],
      }],
      visualizationSlides: [{
        id: crypto.randomUUID(),
        title: 'Практическая визуализация',
        blocks: [
          { id: crypto.randomUUID(), type: 'title', content: 'Интерактивный пример' },
          { id: crypto.randomUUID(), type: 'graph', content: '' },
        ],
      }],
      theoryCompleted: false,
      tasksCompleted: false,
    }
    commitCourses((current) => [...current, newCourse])
    setNavigationMessage('Урок добавлен. Измени его название и открой редактор материалов.')
  }

  function moveCourse(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= courses.length) return
    commitCourses((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    setNavigationMessage(`Порядок уроков обновлён: «${courses[target].title}» теперь ${direction < 0 ? 'выше' : 'ниже'}.`)
  }

  function renameCourse(id: string, title: string) {
    updateCourse(id, { title })
  }

  function describeCourse(id: string, description: string) {
    updateCourse(id, { description })
  }

  function deleteCourse(course: Course) {
    if (courses.length <= 1) return
    if (!window.confirm(`Удалить урок «${course.title}» вместе с его прогрессом?`)) return
    const nextCourses = courses.filter((item) => item.id !== course.id)
    commitCourses((current) => current.filter((item) => item.id !== course.id))
    if (activeCourseId === course.id) {
      setActiveCourseId(nextCourses[0].id)
      setView('home')
      setSection('theory')
    }
    // Keep the lesson's task data in localStorage so Ctrl+Z can restore it intact.
  }

  async function copyAllLearningLogs() {
    const duration = (ms: number) => { const sec = Math.floor(ms / 1000); return `${Math.floor(sec / 3600)} ч ${Math.floor(sec % 3600 / 60)} мин ${sec % 60} сек` }
    const lines = ['GRAPHEDU — ПОЛНЫЙ ОТЧЁТ ПО ВСЕМ УРОКАМ', `Дата формирования: ${new Date().toLocaleString('ru-RU')}`, `Браузер: ${navigator.userAgent}`, `Курсов в каталоге: ${courses.length}`, 'Прогресс хранится локально в браузере.', '']
    for (const course of courses) {
      const taskKey = course.id === 'course-bfs' ? 'graph-edu-tasks' : `graph-edu-tasks-${course.id}`
      const progressKey = course.id === 'course-bfs' ? 'graph-edu-task-progress' : `graph-edu-task-progress-${course.id}`
      let tasks: any[] = []; let progress: Record<string, any> = {}
      try { tasks = JSON.parse(localStorage.getItem(taskKey) || '[]') } catch {}
      try { progress = JSON.parse(localStorage.getItem(progressKey) || '{}') } catch {}
      const done = tasks.filter(task => progress[task.id]?.correct).length
      const points = tasks.reduce((sum, task) => sum + (progress[task.id]?.correct ? Number(task.points || 0) : 0), 0)
      const total = tasks.reduce((sum, task) => sum + Number(task.points || 0), 0)
      const time = tasks.reduce((sum, task) => sum + Number(progress[task.id]?.timeSpentMs || 0), 0)
      lines.push('='.repeat(78), `УРОК: ${course.title}`, `ID: ${course.id}`, `Теория завершена: ${course.theoryCompleted ? 'да' : 'нет'}`, `Задачи урока завершены: ${course.tasksCompleted ? 'да' : 'нет'}`, `Заданий решено: ${done}/${tasks.length}`, `Баллы: ${points}/${total}`, `Суммарное активное время по заданиям: ${duration(time)}`, '')
      tasks.forEach((task, index) => {
        const p = progress[task.id] || {}
        lines.push('-'.repeat(64), `Задание ${index + 1}: ${task.title || '(без названия)'}`, `ID задания: ${task.id}`, `Тип: ${task.type}`, `Статус: ${p.correct ? 'РЕШЕНО ВЕРНО' : p.checked ? 'ПРОВЕРЕНО, НО НЕВЕРНО' : 'НЕ ЗАВЕРШЕНО'}`, `Баллы: ${p.correct ? task.points : 0}/${task.points}`, `Попытки: ${p.attempts || 0}`, `Активное время: ${duration(p.timeSpentMs || 0)}`, `Начало: ${p.startedAt ? new Date(p.startedAt).toLocaleString('ru-RU') : 'не зафиксировано'}`, `Завершено верно: ${p.completedAt ? new Date(p.completedAt).toLocaleString('ru-RU') : 'нет'}`, `Условие: ${task.prompt || ''}`)
        if (task.options?.length) lines.push('Варианты: ' + task.options.map((option: string, i: number) => `${i + 1}) ${option}`).join(' | '), `Выбранные варианты: ${(p.selectedIndexes || []).map((i: number) => task.options[i]).filter(Boolean).join(' | ') || '(нет)'}`)
        if (task.type === 'programming') {
          lines.push(`Язык: ${p.codeLanguage || task.language || 'не выбран'}`, 'Код ученика:', p.codeAnswer || '(код не вводился)', `Статус отправки: ${p.submissionStatus || 'не отправлялось'}`, `Сообщение проверки: ${p.submissionMessage || '(нет)'}`)
          ;(p.submissionResults || []).forEach((result: any) => lines.push(`Тест ${Number(result.index) + 1}: ${result.passed ? 'пройден' : 'не пройден'}; статус=${result.status}; ${result.details || ''}`))
        } else lines.push(`Текстовый ответ: ${p.textAnswer || '(нет ответа)'}`)
        if (p.activityLog?.length) lines.push('История действий:', ...p.activityLog.map((entry: string) => `  ${entry}`))
        lines.push('')
      })
    }
    lines.push('Конец отчёта. Время учитывается, пока вкладка урока открыта и видима. Данные не отправляются на сервер автоматически.')
    const report = lines.join('\n')
    try { await navigator.clipboard.writeText(report); setLogsMessage('Все логи скопированы. Вставь их в текстовый файл или сообщение.') }
    catch { const area = document.createElement('textarea'); area.value = report; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.appendChild(area); area.select(); const ok = document.execCommand('copy'); area.remove(); setLogsMessage(ok ? 'Все логи скопированы.' : 'Не удалось скопировать. Проверь разрешение на буфер обмена.') }
  }

  if (!activeCourse) return null

  const allCompletedCount = courses.filter(isCourseCompleted).length
  const currentCourseIndex = courses.findIndex((course) => course.id === activeCourse.id)
  const progressPercent = (course: Course) => (course.theoryCompleted ? 50 : 0) + (course.tasksCompleted ? 50 : 0)

  return (
    <main className="app">
      <header className="topbar">
        <button type="button" className="logo logo-button" onClick={() => { setView('home'); setNavigationMessage('') }} aria-label="Открыть главную страницу">
          Graph<span>Edu</span>
        </button>
        <div className="top-actions">
          <span className="save-status">● Сохранение в браузере</span>
          <button type="button" className="button" onClick={() => void copyAllLearningLogs()}>Скопировать все логи</button>
          {editing && <span className="undo-shortcut-hint">Ctrl+Z — отменить действие</span>}
          {editing && <>
            <button type="button" className="button" onClick={downloadGraphEduBackup}>Экспорт данных</button>
            <button type="button" className="button" onClick={() => importFileRef.current?.click()}>Импорт данных</button>
            <input ref={importFileRef} type="file" accept=".json,application/json" hidden onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void importGraphEduBackup(file) }} />
          </>}
          <button className={editing ? 'button primary' : 'button'} onClick={() => setEditing((current) => !current)}>
            {editing ? 'Готово' : 'Редактировать'}
          </button>
        </div>
      </header>
      {backupMessage && <div className="course-notice" role="status">{backupMessage}</div>}
      {logsMessage && <div className="course-notice" role="status">{logsMessage}</div>}

      {isHome ? (
        <>
          <section className="course-home-hero">
            <span className="eyebrow">GRAPHEDU · ОБУЧЕНИЕ</span>
            <h1>Мои уроки</h1>
            <p>Проходи уроки по порядку: изучай теорию, экспериментируй с визуализацией и закрепляй знания домашними заданиями.</p>
            <div className="course-home-summary">
              <div><strong>{allCompletedCount} / {courses.length}</strong><span>уроков пройдено</span></div>
              <div className="course-summary-track"><span style={{ width: `${courses.length ? (allCompletedCount / courses.length) * 100 : 0}%` }} /></div>
            </div>
            {editing && <button type="button" className="button primary course-add-button" onClick={addCourse}>＋ Добавить урок</button>}
          </section>

          {navigationMessage && <div className="course-notice" role="status">{navigationMessage}</div>}

          <section className="course-catalog" aria-label="Список уроков">
            {courses.map((course, index) => {
              const completed = isCourseCompleted(course)
              const unlocked = canOpenCourse(index)
              const percent = progressPercent(course)
              return (
                <article className={`course-card ${completed ? 'course-card-complete' : ''} ${!unlocked ? 'course-card-locked' : ''}`} key={course.id}>
                  <div className="course-card-topline">
                    <span className="course-number">УРОК {String(index + 1).padStart(2, '0')}</span>
                    <span className={`course-status ${completed ? 'complete' : unlocked ? 'available' : 'locked'}`}>
                      {completed ? '✓ Пройден' : unlocked ? (percent ? 'В процессе' : 'Доступен') : '🔒 Закрыт'}
                    </span>
                  </div>
                  {editing ? (
                    <div className="course-editor-fields">
                      <label>Название урока<input value={course.title} onChange={(event) => renameCourse(course.id, event.target.value)} placeholder="Например, Поиск в ширину" /></label>
                      <label>Описание<textarea value={course.description} onChange={(event) => describeCourse(course.id, event.target.value)} rows={2} placeholder="Кратко о содержании урока" /></label>
                    </div>
                  ) : (
                    <>
                      <h2>{course.title}</h2>
                      <p className="course-card-description">{course.description}</p>
                    </>
                  )}
                  <div className="course-progress-row"><span>Прогресс</span><strong>{percent}%</strong></div>
                  <div className="course-progress-track"><span style={{ width: `${percent}%` }} /></div>
                  <div className="course-card-bottom">
                    <button type="button" className={`button ${unlocked || editing ? 'primary' : ''}`} disabled={!unlocked && !editing} onClick={() => openCourse(course, index)}>
                      {completed ? 'Повторить урок' : editing && !unlocked ? 'Открыть редактор' : unlocked ? 'Открыть урок' : 'Сначала предыдущий урок'}
                    </button>
                    {editing && (
                      <div className="course-order-actions" aria-label={`Порядок урока ${index + 1}`}>
                        <button type="button" disabled={index === 0} onClick={() => moveCourse(index, -1)} title="Переместить урок выше" aria-label="Переместить урок выше">↑</button>
                        <button type="button" disabled={index === courses.length - 1} onClick={() => moveCourse(index, 1)} title="Переместить урок ниже" aria-label="Переместить урок ниже">↓</button>
                      </div>
                    )}
                    {editing && <button type="button" className="course-delete-button" disabled={courses.length <= 1} onClick={() => deleteCourse(course)} title="Удалить урок">Удалить</button>}
                  </div>
                </article>
              )
            })}
          </section>
          <footer>GraphEdu <span>· Учись понимать алгоритмы</span></footer>
        </>
      ) : (
        <>
          <div className="course-back-row">
            <button type="button" className="button" onClick={() => { setView('home'); setNavigationMessage('') }}>← Все уроки</button>
            <span>Урок {currentCourseIndex + 1} из {courses.length}{courseCompleted ? ' · Пройден' : ''}</span>
          </div>

          <section className="page-heading">
            <span className="eyebrow">УРОК {String(currentCourseIndex + 1).padStart(2, '0')} · {isTasks ? 'ДОМАШНЯЯ РАБОТА' : isVisualization ? 'ВИЗУАЛИЗАЦИЯ' : 'ТЕОРИЯ'}</span>
            <h1>{activeCourse.title}</h1>
            <p>{activeCourse.description}</p>
          </section>

          <nav className="tabs" aria-label="Разделы урока">
            <button type="button" className={`tab ${section === 'theory' ? 'active' : ''}`} onClick={() => selectSection('theory')}>Теория</button>
            <button type="button" className={`tab ${isVisualization ? 'active' : ''} ${!activeCourse.theoryCompleted && !editing ? 'locked' : ''}`} disabled={!activeCourse.theoryCompleted && !editing} onClick={() => selectSection('visualization')} title={!activeCourse.theoryCompleted ? 'Сначала заверши теорию' : 'Открыть визуализацию'}>Визуализация</button>
            <button type="button" className={`tab ${isTasks ? 'active' : ''} ${!activeCourse.theoryCompleted && !editing ? 'locked' : ''}`} disabled={!activeCourse.theoryCompleted && !editing} onClick={() => selectSection('tasks')} title={!activeCourse.theoryCompleted ? 'Сначала заверши теорию' : 'Открыть домашнюю работу'}>Задачи</button>
          </nav>

          {!isTasks && (
            <section className="slide-navigation">
              <button className="slide-arrow" disabled={activeSlide === 0} onClick={previousSlide}>←</button>
              <div className="slide-indicator"><span className="slide-label">СЛАЙД</span><strong>{activeSlide + 1}</strong><span>из {slides.length}</span></div>
              <button className="slide-arrow" disabled={activeSlide >= slides.length - 1} onClick={nextSlide}>→</button>
            </section>
          )}

          {editing && !isTasks && (
            <section className="editor-panel">
              <div><strong>{isVisualization ? 'Редактор визуализации' : 'Редактор теории'}</strong><p>{isVisualization ? 'Настраивай интерактивные примеры и слайды.' : 'Добавляй теорию и располагай блоки в нужном порядке.'}</p></div>
              <div className="add-actions">
                <button onClick={() => addBlock('title')}>＋ Заголовок</button>
                <button onClick={() => addBlock('text')}>＋ Текст</button>
                <button onClick={() => addBlock('list')}>＋ Список</button>
                <button onClick={() => addBlock('code')}>＋ Псевдокод</button>
                <button onClick={() => addBlock('graph')}>＋ Граф</button>
                <button onClick={() => addBlock('grid')}>＋ Сетка / Flood Fill</button>
                <button onClick={() => addBlock('fifo')}>＋ FIFO</button>
                <button onClick={() => addBlock('question')}>＋ Вопрос</button>
                <button className="slide-create-button" onClick={createSlide}>＋ Новый слайд</button>
              </div>
            </section>
          )}

          {isTasks ? (
            <TasksPanel key={activeCourse.id} editing={editing} courseId={activeCourse.id} courseTitle={activeCourse.title} onCompletionChange={handleTasksCompletionChange} />
          ) : (
            <section className="slide-card">
              {editing ? (
                <div className="slide-title-editor">
                  <span>Название слайда</span><input value={slide?.title ?? ''} onChange={(event) => updateSlideTitle(event.target.value)} />
                  <button className="slide-delete-button" disabled={slides.length === 1} onClick={deleteSlide}>Удалить слайд</button>
                </div>
              ) : <div className="slide-title">{slide?.title}</div>}

              <section className="theory">
                {slides.length === 0 && editing && <div className="empty-slide">На этом слайде пока нет блоков. Добавь блок выше.</div>}
                {slide?.blocks.map((block, index) => (
                  <article className="theory-block" key={block.id}>
                    {editing ? (
                      <div className="edit-card">
                        <div className="block-toolbar"><span>{block.type === 'title' ? 'Заголовок' : block.type === 'list' ? 'Список' : block.type === 'code' ? 'Псевдокод' : block.type === 'graph' ? 'Граф' : block.type === 'grid' ? 'Сетка / Flood Fill' : block.type === 'fifo' ? 'FIFO' : block.type === 'question' ? 'Вопрос' : 'Текст'}</span>
                          <div className="block-actions"><button disabled={index === 0} onClick={() => moveBlock(index, -1)}>↑</button><button disabled={index === slides[activeSlide].blocks.length - 1} onClick={() => moveBlock(index, 1)}>↓</button><button className="delete-button" onClick={() => deleteBlock(block.id)}>Удалить</button></div>
                        </div>
                        {block.type === 'graph' ? <GraphBlock editable value={block.content} onChange={(value) => updateBlock(block.id, value)} />
                          : block.type === 'grid' ? <GridBlock editable value={block.content} onChange={(value) => updateBlock(block.id, value)} />
                            : block.type === 'fifo' ? <FIFOBlock editable value={block.content} onChange={(value) => updateBlock(block.id, value)} />
                            : block.type === 'question' ? <QuestionEditor value={block.content} onChange={(value) => updateBlock(block.id, value)} />
                              : <textarea className={block.type === 'code' ? 'theory-code-editor' : undefined} value={block.content} onChange={(event) => updateBlock(block.id, event.target.value)} rows={block.type === 'title' ? 2 : block.type === 'code' ? 10 : 4} spellCheck={block.type !== 'code'} />}
                        {block.type === 'list' && <small>Каждая строка станет отдельным пунктом.</small>}
                      </div>
                    ) : (
                      <>
                        {block.type === 'title' && (index === 0 ? <h2 className="theory-title">{block.content}</h2> : <h3>{block.content}</h3>)}
                        {block.type === 'text' && <p className="theory-text">{block.content}</p>}
                        {block.type === 'list' && <ul className="theory-list">{block.content.split('\n').filter(Boolean).map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul>}
                        {block.type === 'code' && <div className="theory-code-window"><div className="theory-code-window-bar"><span></span><span></span><span></span><small>Псевдокод</small></div><pre><code>{block.content}</code></pre></div>}
                        {block.type === 'graph' && <GraphBlock value={block.content} />}
                        {block.type === 'grid' && <GridBlock value={block.content} />}
                        {block.type === 'fifo' && <FIFOBlock value={block.content} />}
                        {block.type === 'question' && <QuestionBlock value={block.content} completed={!!correctQuestions[block.id]} onCorrectChange={(correct) => { if (correct) setCorrectQuestions((current) => ({ ...current, [block.id]: true })) }} />}
                      </>
                    )}
                  </article>
                ))}
              </section>
            </section>
          )}

          {navigationMessage && <div className="course-notice" role="status">{navigationMessage}</div>}

          {!isTasks && (
            <section className="bottom-slide-navigation">
              <button className="button" disabled={activeSlide === 0} onClick={previousSlide}>← Назад</button>
              <span>{activeSlide + 1} / {slides.length}</span>
              {section === 'theory' && activeSlide === slides.length - 1 && !editing ? (
                <button className="button primary" disabled={activeCourse.theoryCompleted} onClick={markTheoryCompleted}>{activeCourse.theoryCompleted ? '✓ Теория пройдена' : 'Завершить теорию'}</button>
              ) : (
                <button className="button" disabled={activeSlide >= slides.length - 1} onClick={nextSlide}>Далее →</button>
              )}
            </section>
          )}

          {courseCompleted && <div className="course-completion-banner"><strong>✓ Урок пройден!</strong><p>Ты завершил теорию и решил все задания. Вернись на главную, чтобы открыть следующий урок.</p><button type="button" className="button primary" onClick={() => { setView('home'); setNavigationMessage('') }}>К следующему уроку →</button></div>}
          <footer>GraphEdu <span>· Учись понимать алгоритмы</span></footer>
        </>
      )}
    </main>
  )
}

export default App
