import { useEffect, useMemo, useRef, useState } from 'react'
import { additionalTasks } from './courseCatalog'
import { bfsTaskSeed } from './bfsTaskSeed'

type CodeLanguage = 'cpp17' | 'python3' | 'javascript'
type TaskType = 'single' | 'multiple' | 'short' | 'truefalse' | 'fillblank' | 'numeric' | 'matching' | 'ordering' | 'programming'
type MatchPair = { left: string; right: string }
type TestCase = { id: string; input: string; expectedOutput: string; visible: boolean }
type SubmissionStatus = 'idle' | 'running' | 'accepted' | 'rejected' | 'error'
type SubmissionResult = { index: number; passed: boolean; status: string; details?: string }
type Task = {
  id: string
  title: string
  prompt: string
  type: TaskType
  options: string[]
  correctIndexes: number[]
  acceptedAnswers: string[]
  hint: string
  explanation: string
  points: number
  language?: CodeLanguage
  starterCode?: string
  testCases?: TestCase[]
  pairs?: MatchPair[]
  orderItems?: string[]
}
type TaskProgress = {
  selectedIndexes: number[]
  textAnswer: string
  checked: boolean
  correct: boolean
  showHint: boolean
  attempts: number
  codeAnswer?: string
  codeLanguage?: CodeLanguage
  submissionStatus?: SubmissionStatus
  submissionMessage?: string
  submissionResults?: SubmissionResult[]
  matchingAnswers?: number[]
  orderingAnswer?: number[]
  startedAt?: string
  timeSpentMs?: number
  completedAt?: string
  activityLog?: string[]
}
type Filter = 'all' | 'todo' | 'done'

const initialTasks: Task[] = bfsTaskSeed as unknown as Task[]

const blankProgress: TaskProgress = {
  selectedIndexes: [],
  textAnswer: '',
  checked: false,
  correct: false,
  showHint: false,
  attempts: 0,
}

function starterCodeFor(language: CodeLanguage): string {
  if (language === 'python3') return `a, b = map(int, input().split())
print(a + b)`
  if (language === 'javascript') return `const fs = require('fs');
const [a, b] = fs.readFileSync(0, 'utf8').trim().split(/\s+/).map(Number);
console.log(a + b);`
  return `#include <iostream>
using namespace std;

int main() {
    long long a, b;
    cin >> a >> b;
    cout << a + b << "\\n";
    return 0;
}`
}

function makeTask(type: TaskType, index: number): Task {
  const base: Task = {
    id: crypto.randomUUID(),
    title: `Новое задание ${index}`,
    prompt: 'Напиши условие задания...',
    type,
    options: type === 'short' || type === 'fillblank' || type === 'numeric' || type === 'programming' || type === 'matching' || type === 'ordering' ? [] : type === 'truefalse' ? ['Верно', 'Неверно'] : ['Вариант A', 'Вариант B', 'Вариант C'],
    correctIndexes: type === 'short' || type === 'fillblank' || type === 'numeric' || type === 'programming' || type === 'matching' || type === 'ordering' ? [] : type === 'truefalse' ? [0] : [0],
    acceptedAnswers: type === 'short' || type === 'fillblank' || type === 'numeric' ? [''] : [],
    hint: '',
    explanation: '',
    points: type === 'programming' ? 5 : type === 'matching' || type === 'ordering' ? 3 : 1,
  }
  if (type === 'truefalse') {
    base.title = `Верно или неверно ${index}`
    base.prompt = 'Утверждение: BFS использует очередь FIFO. Верно ли это?'
  }
  if (type === 'fillblank') {
    base.title = `Заполни пропуск ${index}`
    base.prompt = 'BFS использует структуру данных ______.'
    base.acceptedAnswers = ['очередь', 'очередь FIFO', 'fifo']
  }
  if (type === 'numeric') {
    base.title = `Числовой ответ ${index}`
    base.prompt = 'Сколько рёбер содержит остовное дерево на 5 вершинах?'
    base.acceptedAnswers = ['4']
  }
  if (type === 'matching') {
    base.title = `Установи соответствие ${index}`
    base.prompt = 'Соедини понятие с его описанием.'
    base.pairs = [{ left: 'BFS', right: 'Обход в ширину' }, { left: 'DFS', right: 'Обход в глубину' }, { left: 'FIFO', right: 'Первым пришёл — первым вышел' }]
  }
  if (type === 'ordering') {
    base.title = `Расставь шаги ${index}`
    base.prompt = 'Расположи шаги алгоритма в правильном порядке.'
    base.orderItems = ['Отметить стартовую вершину посещённой', 'Добавить стартовую вершину в очередь', 'Извлечь вершину из очереди', 'Добавить непосещённых соседей в очередь']
  }
  if (type === 'programming') {
    base.language = 'cpp17'
    base.starterCode = starterCodeFor('cpp17')
    base.testCases = [{ id: crypto.randomUUID(), input: '2 3\n', expectedOutput: '5\n', visible: true }]
  }
  return base
}

function loadTasks(courseId: string): Task[] {
  const storageKey = courseId === 'course-bfs' ? 'graph-edu-tasks' : `graph-edu-tasks-${courseId}`
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      const parsed = JSON.parse(saved) as unknown
      if (Array.isArray(parsed) && parsed.every(isTask)) {
        const tasks: Task[] = parsed.map((task) => ({
          ...task,
          language: task.language ?? 'cpp17',
          starterCode: task.starterCode ?? starterCodeFor('cpp17'),
          // Repair older saved tests where line breaks were stored as literal \\n.
          testCases: (task.testCases ?? []).map((testCase) => ({
            ...testCase,
            input: normalizeLineBreaks(testCase.input),
            expectedOutput: normalizeLineBreaks(testCase.expectedOutput),
          })),
        }))
        // Add the new programming example once for existing BFS lessons, without
        // re-creating it if the editor intentionally removes it later.
        const migrationKey = 'graph-edu-code-task-template-v1-added'
        if (courseId === 'course-bfs' && localStorage.getItem(migrationKey) !== 'true') {
          const codeTemplate = initialTasks.find((task) => task.id === 'bfs-task-code-1')
          if (codeTemplate && !tasks.some((task) => task.id === codeTemplate.id)) tasks.push(codeTemplate)
          localStorage.setItem(migrationKey, 'true')
        }
        return tasks
      }
    }
  } catch {
    // Если сохранение повреждено, запускаем стартовый набор заданий.
  }
  if (courseId === 'course-bfs') {
    localStorage.setItem('graph-edu-code-task-template-v1-added', 'true')
    return initialTasks
  }
  return (additionalTasks[courseId] ?? []) as Task[]
}

function normalizeLineBreaks(value: string): string {
  return value.replace(/\\r\\n/g, '\r\n').replace(/\\n/g, '\n').replace(/\\r/g, '\r')
}

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== 'object') return false
  const task = value as Record<string, unknown>
  return typeof task.id === 'string' &&
    typeof task.title === 'string' &&
    typeof task.prompt === 'string' &&
    ['single', 'multiple', 'short', 'truefalse', 'fillblank', 'numeric', 'matching', 'ordering', 'programming'].includes(String(task.type)) &&
    Array.isArray(task.options) && task.options.every((x) => typeof x === 'string') &&
    Array.isArray(task.correctIndexes) && task.correctIndexes.every((x) => Number.isInteger(x)) &&
    Array.isArray(task.acceptedAnswers) && task.acceptedAnswers.every((x) => typeof x === 'string') &&
    typeof task.hint === 'string' &&
    typeof task.explanation === 'string' &&
    typeof task.points === 'number' &&
    (task.pairs === undefined || (Array.isArray(task.pairs) && task.pairs.every((pair: unknown) => !!pair && typeof pair === 'object' && typeof (pair as Record<string, unknown>).left === 'string' && typeof (pair as Record<string, unknown>).right === 'string'))) &&
    (task.orderItems === undefined || (Array.isArray(task.orderItems) && task.orderItems.every((item: unknown) => typeof item === 'string'))) &&
    (task.type !== 'programming' || (
      ['cpp17', 'python3', 'javascript'].includes(String(task.language)) &&
      typeof task.starterCode === 'string' &&
      Array.isArray(task.testCases) &&
      task.testCases.every((testCase: unknown) => {
        if (!testCase || typeof testCase !== 'object') return false
        const item = testCase as Record<string, unknown>
        return typeof item.id === 'string' && typeof item.input === 'string' &&
          typeof item.expectedOutput === 'string' && typeof item.visible === 'boolean'
      })
    ))
}

function loadProgress(courseId: string): Record<string, TaskProgress> {
  const storageKey = courseId === 'course-bfs' ? 'graph-edu-task-progress' : `graph-edu-task-progress-${courseId}`
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved) return JSON.parse(saved) as Record<string, TaskProgress>
  } catch {
    // Используем пустой прогресс.
  }
  return {}
}

function normalizeAnswer(value: string) {
  return value
    .toLocaleLowerCase('ru-RU')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/[.!?]+$/g, '')
}

const JUDGE0_URL = 'https://ce.judge0.com'
const JUDGE0_LANGUAGE_IDS: Record<CodeLanguage, number> = {
  cpp17: 54,
  python3: 71,
  javascript: 63,
}

type Judge0Response = {
  token?: string
  status?: { id: number; description: string }
  stdout?: string | null
  stderr?: string | null
  compile_output?: string | null
  message?: string | null
  error?: string
}

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))

async function runJudge0Test(sourceCode: string, language: CodeLanguage, testCase: TestCase, index: number): Promise<SubmissionResult> {
  const createResponse = await fetch(`${JUDGE0_URL}/submissions/?base64_encoded=false&wait=false`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      source_code: sourceCode,
      language_id: JUDGE0_LANGUAGE_IDS[language],
      ...(language === 'cpp17' ? { compiler_options: '-std=c++17' } : {}),
      stdin: normalizeLineBreaks(testCase.input),
      expected_output: normalizeLineBreaks(testCase.expectedOutput),
      cpu_time_limit: 2,
      wall_time_limit: 5,
      memory_limit: 128000,
      enable_network: false,
    }),
  })

  const createData = await createResponse.json().catch(() => ({})) as Judge0Response
  if (!createResponse.ok) {
    throw new Error(createData.error || createData.message || `Сервис проверки ответил кодом ${createResponse.status}.`)
  }

  let result = createData
  if (!result.status || result.status.id <= 2) {
    const submissionToken = result.token
    if (!submissionToken) throw new Error('Сервис проверки не вернул номер отправки.')
    let finished = false
    for (let attempt = 0; attempt < 25; attempt++) {
      await wait(1200)
      const statusResponse = await fetch(`${JUDGE0_URL}/submissions/${encodeURIComponent(submissionToken)}?base64_encoded=false&fields=token,status,stdout,stderr,compile_output,message,time,memory`)
      const statusData = await statusResponse.json().catch(() => ({})) as Judge0Response
      if (!statusResponse.ok) {
        throw new Error(statusData.error || statusData.message || `Ошибка чтения результата: ${statusResponse.status}.`)
      }
      result = statusData
      if (result.status && result.status.id > 2) {
        finished = true
        break
      }
    }
    if (!finished) return { index, passed: false, status: 'Превышено время ожидания', details: 'Проверка заняла слишком много времени. Попробуй отправить решение ещё раз.' }
  }

  const status = result.status?.description ?? 'Неизвестный результат'
  const passed = result.status?.id === 3
  const details = result.compile_output || result.stderr || result.message || undefined
  return { index, passed, status, details: details ? String(details).slice(0, 1600) : undefined }
}

function typeLabel(type: TaskType) {
  if (type === 'single') return 'Один ответ'
  if (type === 'multiple') return 'Несколько ответов'
  if (type === 'programming') return 'Программирование'
  if (type === 'truefalse') return 'Верно / неверно'
  if (type === 'fillblank') return 'Заполнить пропуск'
  if (type === 'numeric') return 'Числовой ответ'
  if (type === 'matching') return 'Установить соответствие'
  if (type === 'ordering') return 'Порядок шагов'
  return 'Короткий ответ'
}

function TaskEditor({
  task,
  onChange,
  onDelete,
  onDuplicate,
  onMove,
  isFirst,
  isLast,
}: {
  task: Task
  onChange: (changes: Partial<Task>) => void
  onDelete: () => void
  onDuplicate: () => void
  onMove: (direction: -1 | 1) => void
  isFirst: boolean
  isLast: boolean
}) {
  function changeType(type: TaskType) {
    const template = makeTask(type, 1)
    onChange({
      type,
      options: template.options,
      correctIndexes: template.correctIndexes,
      acceptedAnswers: template.acceptedAnswers,
      pairs: template.pairs ?? task.pairs,
      orderItems: template.orderItems ?? task.orderItems,
      ...(type === 'programming' ? {
        language: task.language ?? 'cpp17',
        starterCode: task.starterCode || starterCodeFor(task.language ?? 'cpp17'),
        testCases: task.testCases?.length ? task.testCases : template.testCases,
      } : {}),
    })
  }

  function changeCodeLanguage(language: CodeLanguage) {
    const oldLanguage = task.language ?? 'cpp17'
    const oldDefault = starterCodeFor(oldLanguage)
    const code = task.starterCode ?? ''
    onChange({
      language,
      starterCode: !code.trim() || code === oldDefault ? starterCodeFor(language) : code,
    })
  }

  function updateTestCase(index: number, changes: Partial<TestCase>) {
    const testCases = task.testCases ?? []
    onChange({ testCases: testCases.map((testCase, i) => i === index ? { ...testCase, ...changes } : testCase) })
  }

  function addTestCase() {
    const testCases = task.testCases ?? []
    if (testCases.length >= 12) return
    onChange({ testCases: [...testCases, { id: crypto.randomUUID(), input: '', expectedOutput: '', visible: false }] })
  }

  function removeTestCase(index: number) {
    onChange({ testCases: (task.testCases ?? []).filter((_, i) => i !== index) })
  }

  function updateOption(index: number, text: string) {
    onChange({ options: task.options.map((option, i) => i === index ? text : option) })
  }

  function toggleCorrect(index: number, checked: boolean) {
    if (task.type !== 'multiple') {
      onChange({ correctIndexes: [index] })
      return
    }
    const next = checked
      ? [...task.correctIndexes, index]
      : task.correctIndexes.filter((item) => item !== index)
    onChange({ correctIndexes: next })
  }

  function addOption() {
    onChange({ options: [...task.options, `Вариант ${task.options.length + 1}`] })
  }

  function removeOption(index: number) {
    if (task.options.length <= 2) return
    onChange({
      options: task.options.filter((_, i) => i !== index),
      correctIndexes: task.correctIndexes
        .filter((correctIndex) => correctIndex !== index)
        .map((correctIndex) => correctIndex > index ? correctIndex - 1 : correctIndex),
    })
  }

  return (
    <div className="task-editor">
      <div className="task-editor-heading">
        <div>
          <span className="task-editor-kicker">РЕДАКТОР ЗАДАНИЯ</span>
          <h3>{task.title || 'Новое задание'}</h3>
        </div>
        <div className="task-editor-actions">
          <button type="button" onClick={() => onMove(-1)} disabled={isFirst} title="Переместить вверх">↑</button>
          <button type="button" onClick={() => onMove(1)} disabled={isLast} title="Переместить вниз">↓</button>
          <button type="button" onClick={onDuplicate}>Дублировать</button>
          <button type="button" className="task-delete-button" onClick={onDelete}>Удалить</button>
        </div>
      </div>

      <div className="task-editor-grid">
        <label className="task-form-field task-field-wide">
          Название задания
          <input value={task.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Например, Правило FIFO" />
        </label>
        <label className="task-form-field">
          Тип задания
          <select value={task.type} onChange={(e) => changeType(e.target.value as TaskType)}>
            <option value="single">Выбор одного ответа</option>
            <option value="multiple">Выбор нескольких ответов</option>
            <option value="short">Короткий ответ</option>
            <option value="truefalse">Верно / неверно</option>
            <option value="fillblank">Заполнить пропуск</option>
            <option value="numeric">Числовой ответ</option>
            <option value="matching">Установить соответствие</option>
            <option value="ordering">Расставить шаги по порядку</option>
            <option value="programming">Программирование (код)</option>
          </select>
        </label>
        <label className="task-form-field">
          Баллы
          <input type="number" min={1} max={100} value={task.points} onChange={(e) => onChange({ points: Math.max(1, Number(e.target.value) || 1) })} />
        </label>
        <label className="task-form-field task-field-wide">
          Условие задания
          <textarea rows={4} value={task.prompt} onChange={(e) => onChange({ prompt: e.target.value })} placeholder="Полное условие задачи" />
        </label>

        {(task.type === 'single' || task.type === 'multiple' || task.type === 'truefalse') ? (
          <div className="task-form-field task-field-wide">
            <span>{task.type === 'multiple' ? 'Варианты · отметь все правильные' : task.type === 'truefalse' ? 'Отметь правильное утверждение' : 'Варианты · отметь единственный правильный'}</span>
            <div className="task-edit-options">
              {task.options.map((option, index) => (
                <div className="task-edit-option" key={`${task.id}-option-${index}`}>
                  <input
                    type={task.type === 'multiple' ? 'checkbox' : 'radio'}
                    name={`correct-${task.id}`}
                    checked={task.correctIndexes.includes(index)}
                    onChange={(e) => toggleCorrect(index, task.type !== 'multiple' ? true : e.target.checked)}
                    aria-label={`Отметить вариант ${index + 1} правильным`}
                  />
                  <input value={option} onChange={(e) => updateOption(index, e.target.value)} aria-label={`Текст варианта ${index + 1}`} />
                  <button type="button" onClick={() => removeOption(index)} disabled={task.options.length <= 2} aria-label={`Удалить вариант ${index + 1}`}>×</button>
                </div>
              ))}
              <button type="button" className="task-quiet-button" onClick={addOption}>+ Добавить вариант ответа</button>
            </div>
          </div>
        ) : (task.type === 'short' || task.type === 'fillblank' || task.type === 'numeric') ? (
          <label className="task-form-field task-field-wide">
            {task.type === 'fillblank' ? 'Допустимые варианты заполнения' : task.type === 'numeric' ? 'Допустимые числовые ответы' : 'Допустимые правильные ответы'} <span className="task-muted">(каждый с новой строки)</span>
            <textarea
              rows={3}
              value={task.acceptedAnswers.join('\n')}
              onChange={(e) => onChange({ acceptedAnswers: e.target.value.split('\n') })}
              placeholder={'Например:\n3\nтри'}
            />
            <small>Регистр и лишние пробелы не учитываются.</small>
          </label>
        ) : task.type === 'matching' ? (
          <label className="task-form-field task-field-wide">
            Пары для сопоставления <span className="task-muted">(каждая строка: понятие | описание)</span>
            <textarea rows={6} value={(task.pairs ?? []).map((pair) => `${pair.left} | ${pair.right}`).join('\n')} onChange={(e) => onChange({ pairs: e.target.value.split('\n').map((line) => { const split = line.split('|'); return { left: (split[0] ?? '').trim(), right: split.slice(1).join('|').trim() } }).filter((pair) => pair.left || pair.right) })} placeholder={'BFS | Обход в ширину\nDFS | Обход в глубину'} />
            <small>Слева укажи понятие, справа — соответствующее описание.</small>
          </label>
        ) : task.type === 'ordering' ? (
          <label className="task-form-field task-field-wide">
            Правильный порядок шагов <span className="task-muted">(каждый шаг с новой строки, сверху вниз)</span>
            <textarea rows={6} value={(task.orderItems ?? []).join('\n')} onChange={(e) => onChange({ orderItems: e.target.value.split('\n').filter((item) => item.trim()) })} placeholder={'Первый шаг\nВторой шаг\nТретий шаг'} />
            <small>Ученик увидит эти шаги в обратном порядке и сможет переставить их.</small>
          </label>
        ) : (
          <div className="task-form-field task-field-wide programming-editor-config">
            <label className="task-form-field">
              Язык по умолчанию
              <select value={task.language ?? 'cpp17'} onChange={(e) => changeCodeLanguage(e.target.value as CodeLanguage)}>
                <option value="cpp17">C++17 (GCC)</option>
                <option value="python3">Python 3</option>
                <option value="javascript">JavaScript (Node.js)</option>
              </select>
            </label>
            <label className="task-form-field">
              Стартовый код
              <textarea className="task-code-editor" rows={12} spellCheck={false} value={task.starterCode ?? starterCodeFor(task.language ?? 'cpp17')} onChange={(e) => onChange({ starterCode: e.target.value })} />
            </label>
            <div className="task-test-editor-heading">
              <div><strong>Тесты для проверки</strong><small>Добавь примеры и закрытые тесты. Максимум 12 тестов.</small></div>
              <button type="button" className="task-quiet-button" disabled={(task.testCases ?? []).length >= 12} onClick={addTestCase}>＋ Добавить тест</button>
            </div>
            {(task.testCases ?? []).map((testCase, index) => (
              <div className="task-test-case-editor" key={testCase.id}>
                <div className="task-test-case-title"><strong>Тест {index + 1}</strong><button type="button" className="task-test-delete" disabled={(task.testCases ?? []).length <= 1} onClick={() => removeTestCase(index)}>Удалить</button></div>
                <div className="task-test-case-grid">
                  <label className="task-form-field">Входные данные<textarea rows={3} value={testCase.input} onChange={(e) => updateTestCase(index, { input: e.target.value })} placeholder="Данные, которые получит программа" /></label>
                  <label className="task-form-field">Ожидаемый вывод<textarea rows={3} value={testCase.expectedOutput} onChange={(e) => updateTestCase(index, { expectedOutput: e.target.value })} placeholder="Что должна вывести программа" /></label>
                </div>
                <label className="task-test-visible"><input type="checkbox" checked={testCase.visible} onChange={(e) => updateTestCase(index, { visible: e.target.checked })} /> Показывать этот тест ученику</label>
              </div>
            ))}
            <p className="task-judge-notice">Для проверки используется внешний сервис Judge0. При отправке программа и входные данные передаются этому сервису для компиляции и запуска.</p>
          </div>
        )}

        <label className="task-form-field task-field-wide">
          Подсказка <span className="task-muted">(показывается по запросу ученика)</span>
          <textarea rows={2} value={task.hint} onChange={(e) => onChange({ hint: e.target.value })} placeholder="Направь ученика к способу решения, не раскрывая ответ" />
        </label>
        <label className="task-form-field task-field-wide">
          Разбор решения <span className="task-muted">(открывается после правильного ответа)</span>
          <textarea rows={3} value={task.explanation} onChange={(e) => onChange({ explanation: e.target.value })} placeholder="Объясни ход решения и почему ответ верный" />
        </label>
      </div>
    </div>
  )
}

export default function TasksPanel({ editing, courseId, courseTitle, onCompletionChange }: { editing: boolean; courseId: string; courseTitle: string; onCompletionChange?: (completed: boolean) => void }) {
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks(courseId))
  const [progress, setProgress] = useState<Record<string, TaskProgress>>(() => loadProgress(courseId))
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const undoHistory = useRef<Array<{ tasks: Task[]; progress: Record<string, TaskProgress>; selectedTaskId: string }>>([])

  function rememberTaskEdit() {
    if (!editing) return
    undoHistory.current.push({
      tasks: JSON.parse(JSON.stringify(tasks)) as Task[],
      progress: JSON.parse(JSON.stringify(progress)) as Record<string, TaskProgress>,
      selectedTaskId,
    })
    if (undoHistory.current.length > 100) undoHistory.current.shift()
  }

  useEffect(() => {
    if (!editing) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== 'z') return
      const previous = undoHistory.current.pop()
      if (!previous) return
      event.preventDefault()
      setTasks(previous.tasks)
      setProgress(previous.progress)
      setSelectedTaskId(previous.selectedTaskId)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editing])

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? tasks[0]
  const selectedProgress = selectedTask ? { ...blankProgress, ...progress[selectedTask.id] } : blankProgress

  useEffect(() => {
    if (editing || !selectedTaskId) return
    setProgress((current) => {
      const item = { ...blankProgress, ...current[selectedTaskId] }
      if (item.startedAt) return current
      return { ...current, [selectedTaskId]: { ...item, startedAt: new Date().toISOString() } }
    })
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      setProgress((current) => {
        const item = { ...blankProgress, ...current[selectedTaskId] }
        return { ...current, [selectedTaskId]: { ...item, timeSpentMs: (item.timeSpentMs ?? 0) + 1000 } }
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [courseId, selectedTaskId, editing])

  const completedCount = tasks.filter((task) => progress[task.id]?.correct).length
  const earnedPoints = tasks.reduce((sum, task) => sum + (progress[task.id]?.correct ? task.points : 0), 0)
  const totalPoints = tasks.reduce((sum, task) => sum + task.points, 0)
  // Programming tasks are optional: course completion depends only on the main, non-code tasks.
  const requiredTasks = tasks.filter((task) => task.type !== 'programming')
  const allTasksCompleted = requiredTasks.length > 0 && requiredTasks.every((task) => !!progress[task.id]?.correct)

  const visibleTasks = useMemo(() => tasks.filter((task) => {
    if (filter === 'done') return !!progress[task.id]?.correct
    if (filter === 'todo') return !progress[task.id]?.correct
    return true
  }), [tasks, filter, progress])

  useEffect(() => {
    const storageKey = courseId === 'course-bfs' ? 'graph-edu-tasks' : `graph-edu-tasks-${courseId}`
    localStorage.setItem(storageKey, JSON.stringify(tasks))
  }, [tasks])

  useEffect(() => {
    const storageKey = courseId === 'course-bfs' ? 'graph-edu-task-progress' : `graph-edu-task-progress-${courseId}`
    localStorage.setItem(storageKey, JSON.stringify(progress))
  }, [progress])

  useEffect(() => {
    onCompletionChange?.(allTasksCompleted)
  }, [allTasksCompleted, onCompletionChange])

  useEffect(() => {
    if (tasks.length && !tasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(tasks[0].id)
    }
  }, [tasks, selectedTaskId])

  function updateTask(id: string, changes: Partial<Task>) {
    rememberTaskEdit()
    setTasks((current) => current.map((task) => task.id === id ? { ...task, ...changes } : task))
    setProgress((current) => ({
      ...current,
      [id]: { ...blankProgress, ...current[id], checked: false, correct: false, selectedIndexes: [], textAnswer: '', submissionStatus: 'idle', submissionMessage: '', submissionResults: [] },
    }))
  }

  function addTask(type: TaskType) {
    rememberTaskEdit()
    const task = makeTask(type, tasks.length + 1)
    setTasks((current) => [...current, task])
    setSelectedTaskId(task.id)
    setFilter('all')
  }

  function duplicateTask(task: Task) {
    rememberTaskEdit()
    const duplicate = { ...task, id: crypto.randomUUID(), title: `${task.title} — копия`, correctIndexes: [...task.correctIndexes], options: [...task.options], acceptedAnswers: [...task.acceptedAnswers] }
    setTasks((current) => {
      const index = current.findIndex((item) => item.id === task.id)
      const next = [...current]
      next.splice(index + 1, 0, duplicate)
      return next
    })
    setSelectedTaskId(duplicate.id)
  }

  function deleteTask(id: string) {
    if (!window.confirm('Удалить это задание?')) return
    rememberTaskEdit()
    setTasks((current) => current.filter((task) => task.id !== id))
    setProgress((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
    if (selectedTaskId === id) {
      const nextTask = tasks.find((task) => task.id !== id)
      setSelectedTaskId(nextTask?.id ?? '')
    }
  }

  function moveTask(id: string, direction: -1 | 1) {
    const indexBeforeMove = tasks.findIndex((task) => task.id === id)
    const targetBeforeMove = indexBeforeMove + direction
    if (indexBeforeMove < 0 || targetBeforeMove < 0 || targetBeforeMove >= tasks.length) return
    rememberTaskEdit()
    setTasks((current) => {
      const index = current.findIndex((task) => task.id === id)
      const target = index + direction
      if (index < 0 || target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function updateResponse(changes: Partial<TaskProgress>) {
    if (!selectedTask) return
    setProgress((current) => ({
      ...current,
      [selectedTask.id]: { ...blankProgress, ...current[selectedTask.id], ...changes },
    }))
  }

  function updateProgressForTask(taskId: string, changes: Partial<TaskProgress>) {
    setProgress((current) => ({
      ...current,
      [taskId]: { ...blankProgress, ...current[taskId], ...changes },
    }))
  }

  async function submitCodeAnswer(task: Task) {
    const sourceCode = selectedProgress.codeAnswer ?? task.starterCode ?? starterCodeFor(task.language ?? 'cpp17')
    const language = selectedProgress.codeLanguage ?? task.language ?? 'cpp17'
    const testCases = (task.testCases ?? []).slice(0, 12)
    if (!sourceCode.trim()) {
      updateProgressForTask(task.id, { submissionStatus: 'error', submissionMessage: 'Сначала введи код программы.' })
      return
    }
    if (!testCases.length) {
      updateProgressForTask(task.id, { submissionStatus: 'error', submissionMessage: 'У этого задания пока нет тестов. Добавь их в редакторе.' })
      return
    }

    const currentProgress = { ...blankProgress, ...progress[task.id] }
    updateProgressForTask(task.id, {
      codeAnswer: sourceCode,
      codeLanguage: language,
      checked: false,
      correct: false,
      attempts: currentProgress.attempts + 1,
      submissionStatus: 'running',
      submissionMessage: 'Отправляем код на проверку…',
      submissionResults: [],
      activityLog: [...(currentProgress.activityLog ?? []), `${new Date().toISOString()} — отправлена попытка №${currentProgress.attempts + 1} (${language})`],
    })

    const results: SubmissionResult[] = new Array(testCases.length)
    let nextTestIndex = 0
    const runWorker = async () => {
      while (true) {
        const index = nextTestIndex++
        if (index >= testCases.length) return
        try {
          results[index] = await runJudge0Test(sourceCode, language, testCases[index], index)
        } catch (error) {
          results[index] = {
            index,
            passed: false,
            status: 'Ошибка проверки',
            details: error instanceof Error ? error.message : 'Не удалось связаться с сервисом проверки.',
          }
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(3, testCases.length) }, () => runWorker()))
    const allPassed = results.every((result) => result.passed)
    const serviceFailed = results.some((result) => result.status === 'Ошибка проверки')
    const status: SubmissionStatus = allPassed ? 'accepted' : serviceFailed ? 'error' : 'rejected'
    const message = allPassed
      ? `Принято! Все ${testCases.length} тестов пройдены.`
      : serviceFailed
        ? 'Не удалось получить результат проверки. Проверь подключение к интернету или попробуй позже.'
        : `Тесты не пройдены: ${results.filter((result) => result.passed).length} из ${results.length}. Исправь решение и отправь ещё раз.`

    updateProgressForTask(task.id, {
      checked: true,
      correct: allPassed,
      completedAt: allPassed ? new Date().toISOString() : currentProgress.completedAt,
      submissionStatus: status,
      submissionMessage: message,
      submissionResults: results,
      activityLog: [...(currentProgress.activityLog ?? []), `${new Date().toISOString()} — отправлена попытка №${currentProgress.attempts + 1} (${language})`, `${new Date().toISOString()} — результат: ${message}`],
    })
  }

  function changeLearnerCodeLanguage(language: CodeLanguage) {
    if (!selectedTask) return
    const oldLanguage = selectedProgress.codeLanguage ?? selectedTask.language ?? 'cpp17'
    const currentCode = selectedProgress.codeAnswer ?? selectedTask.starterCode ?? starterCodeFor(oldLanguage)
    const nextCode = !currentCode.trim() || currentCode === starterCodeFor(oldLanguage)
      ? starterCodeFor(language)
      : currentCode
    updateResponse({
      codeLanguage: language,
      codeAnswer: nextCode,
      checked: false,
      correct: false,
      submissionStatus: 'idle',
      submissionMessage: '',
      submissionResults: [],
    })
  }

  function checkAnswer() {
    if (!selectedTask) return
    let correct: boolean

    if (selectedTask.type === 'single' || selectedTask.type === 'multiple' || selectedTask.type === 'truefalse') {
      const selected = [...selectedProgress.selectedIndexes].sort((a, b) => a - b)
      const expected = [...selectedTask.correctIndexes].sort((a, b) => a - b)
      correct = selected.length > 0 && selected.length === expected.length && selected.every((index, i) => index === expected[i])
    } else if (selectedTask.type === 'matching') {
      const answers = selectedProgress.matchingAnswers ?? []
      const pairs = selectedTask.pairs ?? []
      correct = pairs.length > 0 && answers.length === pairs.length && answers.every((answer, index) => answer === index)
    } else if (selectedTask.type === 'ordering') {
      const items = selectedTask.orderItems ?? []
      const answers = selectedProgress.orderingAnswer ?? items.map((_, index) => items.length - index - 1)
      correct = items.length > 0 && answers.every((answer, index) => answer === index)
    } else {
      const answer = normalizeAnswer(selectedProgress.textAnswer)
      correct = answer.length > 0 && selectedTask.acceptedAnswers.some((accepted) => normalizeAnswer(accepted) === answer)
    }

    const answerSummary = selectedTask.type === 'single' || selectedTask.type === 'multiple' || selectedTask.type === 'truefalse'
      ? selectedProgress.selectedIndexes.map(index => selectedTask.options[index]).join(', ')
      : selectedTask.type === 'matching' ? (selectedProgress.matchingAnswers ?? []).map((index, i) => `${selectedTask.pairs?.[i]?.left} → ${selectedTask.pairs?.[index]?.right ?? 'не выбрано'}`).join('; ')
      : selectedTask.type === 'ordering' ? (selectedProgress.orderingAnswer ?? []).map(index => selectedTask.orderItems?.[index] ?? '').join(' → ')
      : selectedProgress.textAnswer
    updateResponse({ checked: true, correct, completedAt: correct ? new Date().toISOString() : selectedProgress.completedAt, attempts: selectedProgress.attempts + 1, activityLog: [...(selectedProgress.activityLog ?? []), `${new Date().toISOString()} — попытка №${selectedProgress.attempts + 1}: ${correct ? 'верно' : 'неверно'}; ответ: ${answerSummary || '(пусто)'}`] })
  }

  function tryAgain() {
    updateResponse({ checked: false, correct: false, selectedIndexes: [], textAnswer: '', matchingAnswers: [], orderingAnswer: undefined })
  }

  function selectAnotherTask(id: string) {
    setSelectedTaskId(id)
  }

  return (
    <section className="task-center">
      <div className="task-center-topline">
        <div>
          <span className="task-editor-kicker">ДОМАШНЯЯ РАБОТА · {courseTitle.toLocaleUpperCase('ru-RU')}</span>
          <h2>{editing ? 'Конструктор заданий' : `Практика: ${courseTitle}`}</h2>
          <p>{editing ? 'Создавай задания из шаблонов и настраивай автоматическую проверку.' : 'Решай задания по порядку, пользуйся подсказками и изучай разбор после верного ответа.'}</p>
        </div>
        <div className="task-score-card">
          <strong>{earnedPoints}<span> / {totalPoints}</span></strong>
          <small>баллов</small>
          <div className="task-progress-track"><span style={{ width: `${totalPoints ? earnedPoints / totalPoints * 100 : 0}%` }} /></div>
          <small>{completedCount} из {tasks.length} заданий решено</small>
        </div>
      </div>


      {editing && (
        <div className="task-template-bar">
          <div>
            <strong>Добавить по шаблону</strong>
            <span>Выбери нужный формат — задание можно настроить после создания.</span>
          </div>
          <div className="task-template-buttons">
            <button type="button" onClick={() => addTask('single')}>＋ Один ответ</button>
            <button type="button" onClick={() => addTask('multiple')}>＋ Несколько ответов</button>
            <button type="button" onClick={() => addTask('truefalse')}>＋ Верно / неверно</button>
            <button type="button" onClick={() => addTask('short')}>＋ Короткий ответ</button>
            <button type="button" onClick={() => addTask('fillblank')}>＋ Пропуск</button>
            <button type="button" onClick={() => addTask('numeric')}>＋ Число</button>
            <button type="button" onClick={() => addTask('matching')}>＋ Соответствие</button>
            <button type="button" onClick={() => addTask('ordering')}>＋ Порядок шагов</button>
            <button type="button" onClick={() => addTask('programming')}>＋ Код</button>
          </div>
        </div>
      )}

      <div className="task-workspace">
        <aside className="task-list-panel">
          <div className="task-list-heading">
            <strong>Список заданий</strong>
            <span>{tasks.length}</span>
          </div>
          {!editing && (
            <div className="task-filters">
              <button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>Все</button>
              <button className={filter === 'todo' ? 'selected' : ''} onClick={() => setFilter('todo')}>Не решены</button>
              <button className={filter === 'done' ? 'selected' : ''} onClick={() => setFilter('done')}>Решены</button>
            </div>
          )}
          <div className="task-list-items">
            {visibleTasks.map((task) => {
              const done = !!progress[task.id]?.correct
              return (
                <button
                  type="button"
                  key={task.id}
                  className={`task-list-item ${selectedTask?.id === task.id ? 'active' : ''} ${done ? 'done' : ''}`}
                  onClick={() => selectAnotherTask(task.id)}
                >
                  <span className="task-list-number">{done ? '✓' : String(tasks.findIndex((item) => item.id === task.id) + 1).padStart(2, '0')}</span>
                  <span className="task-list-copy">
                    <strong>{task.title || 'Без названия'}</strong>
                    <small>{typeLabel(task.type)} · {task.points} {task.points === 1 ? 'балл' : task.points < 5 ? 'балла' : 'баллов'}</small>
                  </span>
                  <span className="task-list-chevron">›</span>
                </button>
              )
            })}
            {!visibleTasks.length && <div className="task-list-empty">В этой категории пока нет заданий.</div>}
          </div>
        </aside>

        <div className="task-main-panel">
          {!selectedTask ? (
            <div className="task-empty-state">
              <h3>Пока нет заданий</h3>
              <p>Включи режим редактирования и добавь первое задание из шаблона.</p>
            </div>
          ) : editing ? (
            <TaskEditor
              task={selectedTask}
              onChange={(changes) => updateTask(selectedTask.id, changes)}
              onDelete={() => deleteTask(selectedTask.id)}
              onDuplicate={() => duplicateTask(selectedTask)}
              onMove={(direction) => moveTask(selectedTask.id, direction)}
              isFirst={tasks[0]?.id === selectedTask.id}
              isLast={tasks[tasks.length - 1]?.id === selectedTask.id}
            />
          ) : (
            <article className="task-question-card">
              <div className="task-question-topline">
                <span className="task-type-badge">{typeLabel(selectedTask.type)}</span>
                <span className="task-points">{selectedTask.points} {selectedTask.points === 1 ? 'балл' : selectedTask.points < 5 ? 'балла' : 'баллов'}</span>
              </div>
              <h3>{selectedTask.title}</h3>
              <p className="task-prompt">{selectedTask.prompt}</p>

              {selectedTask.type === 'programming' ? (
                <div className="task-programming-workspace">
                  <div className="task-code-language-row">
                    <label>
                      Язык программирования
                      <select
                        value={selectedProgress.codeLanguage ?? selectedTask.language ?? 'cpp17'}
                        disabled={selectedProgress.submissionStatus === 'running'}
                        onChange={(e) => changeLearnerCodeLanguage(e.target.value as CodeLanguage)}
                      >
                        <option value="cpp17">C++17</option>
                        <option value="python3">Python 3</option>
                        <option value="javascript">JavaScript</option>
                      </select>
                    </label>
                    <span className="task-code-file-label">main.{(selectedProgress.codeLanguage ?? selectedTask.language ?? 'cpp17') === 'cpp17' ? 'cpp' : (selectedProgress.codeLanguage ?? selectedTask.language) === 'python3' ? 'py' : 'js'}</span>
                  </div>
                  <label className="task-code-input-label">
                    Твой код
                    <textarea
                      className="task-code-editor task-code-editor-student"
                      value={selectedProgress.codeAnswer ?? selectedTask.starterCode ?? starterCodeFor(selectedTask.language ?? 'cpp17')}
                      spellCheck={false}
                      autoCapitalize="off"
                      autoCorrect="off"
                      disabled={selectedProgress.submissionStatus === 'running'}
                      onChange={(e) => updateResponse({
                        codeAnswer: e.target.value,
                        checked: false,
                        correct: false,
                        submissionStatus: 'idle',
                        submissionMessage: '',
                        submissionResults: [],
                      })}
                    />
                  </label>
                  {(selectedTask.testCases ?? []).some((testCase) => testCase.visible) && (
                    <div className="task-code-examples">
                      <strong>Примеры</strong>
                      {(selectedTask.testCases ?? []).filter((testCase) => testCase.visible).map((testCase, index) => (
                        <div className="task-code-example" key={testCase.id}>
                          <span>Пример {index + 1}</span>
                          <div><small>Входные данные</small><pre>{testCase.input || '(пусто)'}</pre></div>
                          <div><small>Выходные данные</small><pre>{testCase.expectedOutput || '(пусто)'}</pre></div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="task-judge-notice">При нажатии «Отправить решение» исходный код и тестовые данные передаются внешнему сервису Judge0 для безопасной компиляции и проверки.</p>
                  {selectedProgress.submissionStatus && selectedProgress.submissionStatus !== 'idle' && (
                    <div className={`task-code-results ${selectedProgress.submissionStatus}`} role="status">
                      <strong>{selectedProgress.submissionStatus === 'running' ? 'Проверяем решение…' : selectedProgress.submissionMessage}</strong>
                      {selectedProgress.submissionStatus !== 'running' && (selectedProgress.submissionResults ?? []).map((result) => (
                        <div className={`task-code-result ${result.passed ? 'passed' : 'failed'}`} key={`${selectedTask.id}-result-${result.index}`}>
                          <span>{result.passed ? '✓' : '×'} Тест {result.index + 1}</span>
                          <strong>{result.status}</strong>
                          {result.details && <pre>{result.details}</pre>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (selectedTask.type === 'single' || selectedTask.type === 'multiple' || selectedTask.type === 'truefalse') ? (
                <div className="task-answer-options">
                  {selectedTask.options.map((option, index) => {
                    const isSelected = selectedProgress.selectedIndexes.includes(index)
                    const isCorrectOption = selectedTask.correctIndexes.includes(index)
                    const optionClass = selectedProgress.checked && selectedProgress.correct && isCorrectOption
                      ? 'task-answer-option revealed-correct'
                      : `task-answer-option ${isSelected ? 'selected' : ''}`
                    return (
                      <button
                        type="button"
                        key={`${selectedTask.id}-answer-${index}`}
                        className={optionClass}
                        disabled={selectedProgress.checked}
                        onClick={() => {
                          const next = selectedTask.type !== 'multiple'
                            ? [index]
                            : isSelected
                              ? selectedProgress.selectedIndexes.filter((item) => item !== index)
                              : [...selectedProgress.selectedIndexes, index]
                          updateResponse({ selectedIndexes: next })
                        }}
                      >
                        <span className={`task-answer-marker ${selectedTask.type === 'multiple' ? 'square' : ''}`}>{String.fromCharCode(65 + index)}</span>
                        <span>{option}</span>
                        {selectedProgress.checked && selectedProgress.correct && isCorrectOption && <span className="task-answer-check">✓</span>}
                      </button>
                    )
                  })}
                </div>
              ) : selectedTask.type === 'matching' ? (
                <div className="task-matching-list">
                  {(selectedTask.pairs ?? []).map((pair, index) => (
                    <label className="task-matching-row" key={`${selectedTask.id}-pair-${index}`}>
                      <span>{pair.left}</span>
                      <span className="task-matching-arrow">→</span>
                      <select value={(selectedProgress.matchingAnswers ?? [])[index] ?? -1} disabled={selectedProgress.checked} onChange={(e) => {
                        const answers = [...(selectedProgress.matchingAnswers ?? (selectedTask.pairs ?? []).map(() => -1))]
                        answers[index] = Number(e.target.value)
                        updateResponse({ matchingAnswers: answers })
                      }}>
                        <option value={-1}>Выбери соответствие</option>
                        {(selectedTask.pairs ?? []).map((option, optionIndex) => <option key={`${selectedTask.id}-match-option-${optionIndex}`} value={optionIndex}>{option.right}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              ) : selectedTask.type === 'ordering' ? (
                <div className="task-ordering-list">
                  {(selectedProgress.orderingAnswer ?? (selectedTask.orderItems ?? []).map((_, index) => (selectedTask.orderItems ?? []).length - index - 1)).map((itemIndex, position, order) => (
                    <div className="task-ordering-row" key={`${selectedTask.id}-order-${itemIndex}`}>
                      <span className="task-ordering-number">{position + 1}</span>
                      <span>{selectedTask.orderItems?.[itemIndex]}</span>
                      <div>
                        <button type="button" aria-label="Переместить выше" disabled={selectedProgress.checked || position === 0} onClick={() => { const next = [...order]; [next[position - 1], next[position]] = [next[position], next[position - 1]]; updateResponse({ orderingAnswer: next }) }}>↑</button>
                        <button type="button" aria-label="Переместить ниже" disabled={selectedProgress.checked || position === order.length - 1} onClick={() => { const next = [...order]; [next[position + 1], next[position]] = [next[position], next[position + 1]]; updateResponse({ orderingAnswer: next }) }}>↓</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <label className="task-short-answer">
                  <span>Твой ответ</span>
                  <input
                    value={selectedProgress.textAnswer}
                    disabled={selectedProgress.checked}
                    onChange={(e) => updateResponse({ textAnswer: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !selectedProgress.checked) checkAnswer() }}
                    placeholder="Введи ответ здесь"
                  />
                </label>
              )}

              {selectedProgress.checked && (
                <div className={`task-feedback ${selectedProgress.correct ? 'correct' : 'incorrect'}`}>
                  <strong>{selectedProgress.correct ? 'Верно! Отличная работа.' : 'Пока неверно — попробуй ещё раз.'}</strong>
                  <span>{selectedProgress.correct ? `Задание зачтено. Попыток: ${selectedProgress.attempts}.` : 'Можно открыть подсказку и повторить попытку.'}</span>
                </div>
              )}

              {selectedProgress.showHint && selectedTask.hint.trim() && (
                <div className="task-hint-panel"><strong>Подсказка</strong><p>{selectedTask.hint}</p></div>
              )}

              {selectedProgress.checked && selectedProgress.correct && selectedTask.explanation.trim() && (
                <div className="task-explanation-panel">
                  <span>РАЗБОР РЕШЕНИЯ</span>
                  <p>{selectedTask.explanation}</p>
                </div>
              )}

              <div className="task-answer-actions">
                {selectedTask.hint.trim() && !selectedProgress.showHint && !selectedProgress.correct && (
                  <button type="button" className="task-secondary-action" onClick={() => updateResponse({ showHint: true })}>Показать подсказку</button>
                )}
                {selectedTask.type === 'programming' ? (
                  selectedProgress.correct ? (
                    <button
                      type="button"
                      className="task-primary-action"
                      disabled={tasks.findIndex((task) => task.id === selectedTask.id) === tasks.length - 1}
                      onClick={() => {
                        const index = tasks.findIndex((task) => task.id === selectedTask.id)
                        const nextTask = tasks[index + 1]
                        if (nextTask) setSelectedTaskId(nextTask.id)
                      }}
                    >Следующее задание <span>→</span></button>
                  ) : (
                    <button
                      type="button"
                      className="task-primary-action"
                      disabled={selectedProgress.submissionStatus === 'running' || !(selectedProgress.codeAnswer ?? selectedTask.starterCode ?? '').trim() || !(selectedTask.testCases ?? []).length}
                      onClick={() => submitCodeAnswer(selectedTask)}
                    >{selectedProgress.submissionStatus === 'running' ? 'Проверяем…' : 'Отправить решение'} <span>↑</span></button>
                  )
                ) : !selectedProgress.checked ? (
                  <button
                    type="button"
                    className="task-primary-action"
                    onClick={checkAnswer}
                    disabled={['short', 'fillblank', 'numeric'].includes(selectedTask.type) ? !selectedProgress.textAnswer.trim() : selectedTask.type === 'matching' ? (selectedProgress.matchingAnswers ?? []).length !== (selectedTask.pairs ?? []).length || (selectedProgress.matchingAnswers ?? []).some((answer) => answer < 0) : selectedTask.type === 'ordering' ? !(selectedTask.orderItems ?? []).length : selectedProgress.selectedIndexes.length === 0}
                  >Проверить ответ <span>→</span></button>
                ) : selectedProgress.correct ? (
                  <button
                    type="button"
                    className="task-primary-action"
                    disabled={tasks.findIndex((task) => task.id === selectedTask.id) === tasks.length - 1}
                    onClick={() => {
                      const index = tasks.findIndex((task) => task.id === selectedTask.id)
                      const nextTask = tasks[index + 1]
                      if (nextTask) setSelectedTaskId(nextTask.id)
                    }}
                  >Следующее задание <span>→</span></button>
                ) : (
                  <button type="button" className="task-primary-action" onClick={tryAgain}>Попробовать ещё раз</button>
                )}
              </div>
            </article>
          )}
        </div>
      </div>
    </section>
  )
}
