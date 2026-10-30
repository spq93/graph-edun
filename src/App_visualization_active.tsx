import { useLayoutEffect, useEffect, useState } from 'react'
import './App.css'
import './smooth-animations.css'
import './queue-animation.css'
import GraphBlock from './GraphBlock'
import FIFOBlock from './FIFOBlock'


type Block = {
  id: string
  type: 'title' | 'text' | 'list' | 'graph' | 'fifo' | 'question'
  content: string
}

type Slide = {
  id: string
  title: string
  blocks: Block[]
}

type Section = 'theory' | 'visualization'

type SectionSlides = Record<Section, Slide[]>

const initialBlocks: Block[] = [
  { id: 'intro', type: 'title', content: 'Поиск в ширину (BFS)' },
  { id: 'theory', type: 'text', content: 'BFS (Breadth-First Search) — алгоритм обхода графа, который исследует вершины по уровням: сначала ближайшие к стартовой вершине, затем более далёкие.' },
  { id: 'terms', type: 'title', content: 'Основные понятия' },
  { id: 'definitions', type: 'list', content: 'Граф — множество вершин и соединяющих их рёбер.\nОчередь FIFO — первым выходит тот, кто первым вошёл.\nРасстояние — минимальное количество рёбер от стартовой вершины.\nПосещённая вершина — вершина, которую алгоритм уже обнаружил.' },
  { id: 'rule', type: 'text', content: 'Важно: отмечай вершину посещённой сразу при добавлении в очередь. Так одна вершина не попадёт в очередь несколько раз.' },
]

const initialSlides: Slide[] = [{ id: 'slide-1', title: 'Слайд 1', blocks: initialBlocks }]

const initialVisualizationSlides: Slide[] = [{
  id: 'visual-slide-1',
  title: 'Визуализация BFS',
  blocks: [
    { id: 'visual-title', type: 'title', content: 'Пошаговая визуализация BFS' },
    { id: 'visual-graph', type: 'graph', content: '' },
  ],
}]

function loadVisualizationSlides(): Slide[] {
  try {
    const saved = localStorage.getItem('graph-edu-visualization-slides')
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isSlide)) return parsed
    }
  } catch {
    // Используем исходную визуализацию.
  }

  return initialVisualizationSlides
}

function isBlock(value: unknown): value is Block {
  if (!value || typeof value !== 'object') return false
  const b = value as Record<string, unknown>
  return typeof b.id === 'string' &&
    ['title', 'text', 'list', 'graph', 'fifo', 'question'].includes(String(b.type)) &&
    typeof b.content === 'string'
}

function isSlide(value: unknown): value is Slide {
  if (!value || typeof value !== 'object') return false
  const s = value as Record<string, unknown>
  return typeof s.id === 'string' && typeof s.title === 'string' &&
    Array.isArray(s.blocks) && s.blocks.every(isBlock)
}

function loadSlides(): Slide[] {
  try {
    const saved = localStorage.getItem('graph-edu-slides')
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isSlide)) return parsed
    }

    // Совместимость со старой версией: старые блоки становятся первым слайдом.
    const old = localStorage.getItem('graph-edu-theory')
    if (old) {
      const parsed: unknown = JSON.parse(old)
      if (Array.isArray(parsed) && parsed.every(isBlock)) {
        return [{ id: crypto.randomUUID(), title: 'Слайд 1', blocks: parsed }]
      }
    }
  } catch {
    // Используем исходные данные.
  }
  return initialSlides
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

function App() {
  const [section, setSection] = useState<Section>('theory')
  const [sections, setSections] = useState<SectionSlides>(() => ({
    theory: loadSlides(),
    visualization: loadVisualizationSlides(),
  }))
  const [activeSlideBySection, setActiveSlideBySection] = useState<Record<Section, number>>({
    theory: 0,
    visualization: 0,
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

  const slides = sections[section]
  const activeSlide = activeSlideBySection[section]
  const slide = slides[activeSlide]
  const isVisualization = section === 'visualization'

  useLayoutEffect(() => {
    const scrollToTop = () => {
      window.scrollTo(0, 0)
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }

    scrollToTop()

    const frame = requestAnimationFrame(() => {
      scrollToTop()
    })

    return () => cancelAnimationFrame(frame)
  }, [section, activeSlide])

  useEffect(() => {
    localStorage.setItem('graph-edu-slides', JSON.stringify(sections.theory))
  }, [sections.theory])

  useEffect(() => {
    localStorage.setItem('graph-edu-visualization-slides', JSON.stringify(sections.visualization))
  }, [sections.visualization])

  useEffect(() => {
    localStorage.setItem('graph-edu-correct-questions', JSON.stringify(correctQuestions))
  }, [correctQuestions])

  function updateCurrentSlides(updater: (current: Slide[]) => Slide[]) {
    setSections(current => ({
      ...current,
      [section]: updater(current[section]),
    }))
  }

  function changeActiveSlide(updater: (current: number) => number) {
    setActiveSlideBySection(current => ({
      ...current,
      [section]: updater(current[section]),
    }))
  }

  function addBlock(type: Block['type']) {
    const content: Record<Block['type'], string> = {
      title: 'Новый заголовок',
      text: isVisualization ? 'Опишите, что происходит на этом шаге визуализации...' : 'Напишите здесь текст теории...',
      list: 'Первый пункт\nВторой пункт',
      graph: '',
      fifo: JSON.stringify({
        items: ['1', '2', '3', '4'],
        speed: 900,
      }),
      question: JSON.stringify({
        question: 'Какое число будет извлечено следующим?',
        options: ['1', '2', '3', '4'],
        correctIndex: 0,
        hint: '',
      }),
    }
    const block: Block = { id: crypto.randomUUID(), type, content: content[type] }
    updateCurrentSlides(current => current.map((s, i) =>
      i === activeSlide ? { ...s, blocks: [...s.blocks, block] } : s,
    ))
  }

  function updateBlock(id: string, content: string) {
    updateCurrentSlides(current => current.map((s, i) =>
      i === activeSlide
        ? { ...s, blocks: s.blocks.map(b => b.id === id ? { ...b, content } : b) }
        : s,
    ))
  }

  function deleteBlock(id: string) {
    updateCurrentSlides(current => current.map((s, i) =>
      i === activeSlide ? { ...s, blocks: s.blocks.filter(b => b.id !== id) } : s,
    ))
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction
    if (!slide || target < 0 || target >= slide.blocks.length) return
    updateCurrentSlides(current => current.map((s, i) => {
      if (i !== activeSlide) return s
      const blocks = [...s.blocks]
      ;[blocks[index], blocks[target]] = [blocks[target], blocks[index]]
      return { ...s, blocks }
    }))
  }

  function createSlide() {
    const newSlide: Slide = {
      id: crypto.randomUUID(),
      title: `${isVisualization ? 'Визуализация' : 'Слайд'} ${slides.length + 1}`,
      blocks: [{ id: crypto.randomUUID(), type: 'title', content: isVisualization ? 'Новая визуализация' : 'Новый слайд' }],
    }
    updateCurrentSlides(current => [...current, newSlide])
    setActiveSlideBySection(current => ({ ...current, [section]: slides.length }))
  }

  function deleteSlide() {
    if (slides.length === 1) return
    if (!window.confirm(`Удалить слайд ${activeSlide + 1}?`)) return
    updateCurrentSlides(current => current.filter((_, i) => i !== activeSlide))
    changeActiveSlide(current => Math.min(current, slides.length - 2))
  }

  function updateSlideTitle(title: string) {
    updateCurrentSlides(current => current.map((s, i) =>
      i === activeSlide ? { ...s, title } : s,
    ))
  }

  function previousSlide() {
    changeActiveSlide(i => Math.max(0, i - 1))
  }

  function nextSlide() {
    if (section === 'theory' && activeSlide === 1) {
      const questions = slide.blocks.filter(block => block.type === 'question')
      const allCorrect = questions.length > 0 && questions.every(question => correctQuestions[question.id])

      if (!allCorrect) {
        setNavigationMessage('Ответьте правильно на вопрос, чтобы перейти дальше.')
        window.setTimeout(() => {
          document.querySelector('.question-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 0)
        return
      }
    }

    setNavigationMessage('')
    changeActiveSlide(i => Math.min(slides.length - 1, i + 1))
  }

  function selectSection(nextSection: Section) {
    setNavigationMessage('')
    setSection(nextSection)
  }

  if (!slide) return null

  return (
    <main className="app">
      <header className="topbar">
        <a className="logo" href="#">Graph<span>Edu</span></a>
        <div className="top-actions">
          <span className="save-status">● Сохранение в браузере</span>
          <button className={editing ? 'button primary' : 'button'} onClick={() => setEditing(!editing)}>
            {editing ? 'Готово' : 'Редактировать'}
          </button>
        </div>
      </header>

      <section className="page-heading">
        <span className="eyebrow">АЛГОРИТМЫ · {isVisualization ? 'ВИЗУАЛИЗАЦИЯ' : 'ТЕОРИЯ'}</span>
        <h1>{isVisualization ? 'Визуализация BFS' : 'Изучаем графы'}</h1>
        <p>{isVisualization ? 'Наблюдай за работой алгоритма пошагово и создавай собственные интерактивные демонстрации.' : 'Теория, наглядные примеры и интерактивные задачи.'}</p>
      </section>

      <nav className="tabs" aria-label="Разделы GraphEdu">
        <button
          type="button"
          className={`tab ${!isVisualization ? 'active' : ''}`}
          onClick={() => selectSection('theory')}
        >
          Теория BFS
        </button>
        <button
          type="button"
          className={`tab ${isVisualization ? 'active' : ''}`}
          onClick={() => selectSection('visualization')}
        >
          Визуализация
        </button>
        <span className="tab muted">Задачи — скоро</span>
      </nav>

      <section className="slide-navigation">
        <button className="slide-arrow" disabled={activeSlide === 0} onClick={previousSlide}>←</button>
        <div className="slide-indicator">
          <span className="slide-label">СЛАЙД</span>
          <strong>{activeSlide + 1}</strong>
          <span>из {slides.length}</span>
        </div>
        <button className="slide-arrow" disabled={activeSlide === slides.length - 1} onClick={nextSlide}>→</button>
      </section>

      {editing && (
        <section className="editor-panel">
          <div>
            <strong>{isVisualization ? 'Редактор визуализации' : 'Редактор теории'}</strong>
            <p>{isVisualization ? 'Создавай слайды и настраивай интерактивные демонстрации так же, как в теории.' : 'Редактируй содержимое текущего слайда.'}</p>
          </div>
          <div className="add-actions">
            <button onClick={() => addBlock('title')}>+ Заголовок</button>
            <button onClick={() => addBlock('text')}>+ Текст</button>
            <button onClick={() => addBlock('list')}>+ Список</button>
            <button onClick={() => addBlock('graph')}>+ Граф</button>
<button onClick={() => addBlock('fifo')}>+ FIFO</button>
<button onClick={() => addBlock('question')}>+ Вопрос</button>
            <button className="slide-create-button" onClick={createSlide}>+ Новый слайд</button>
          </div>
        </section>
      )}

      <section className="slide-card">
        {editing ? (
          <div className="slide-title-editor">
            <span>Название слайда</span>
            <input value={slide.title} onChange={e => updateSlideTitle(e.target.value)} />
            <button className="slide-delete-button" disabled={slides.length === 1} onClick={deleteSlide}>
              Удалить слайд
            </button>
          </div>
        ) : (
          <div className="slide-title">{slide.title}</div>
        )}

        <section className="theory">
          {slide.blocks.length === 0 && editing && (
            <div className="empty-slide">На этом слайде пока нет блоков. Добавь блок выше.</div>
          )}

          {slide.blocks.map((block, index) => (
            <article className="theory-block" key={block.id}>
              {editing ? (
                <div className="edit-card">
                  <div className="block-toolbar">
                    <span>
                      {block.type === 'title' ? 'Заголовок' :
                       block.type === 'list' ? 'Список' :
                       block.type === 'graph' ? 'Граф' : block.type === 'fifo' ? 'FIFO' : block.type === 'question' ? 'Вопрос' : 'Текст'}
                    </span>
                    <div className="block-actions">
                      <button disabled={index === 0} onClick={() => moveBlock(index, -1)}>↑</button>
                      <button disabled={index === slide.blocks.length - 1} onClick={() => moveBlock(index, 1)}>↓</button>
                      <button className="delete-button" onClick={() => deleteBlock(block.id)}>Удалить</button>
                    </div>
                  </div>

                  {block.type === 'graph' ? (
                    <GraphBlock editable value={block.content} onChange={value => updateBlock(block.id, value)} />
                  ) : block.type === 'fifo' ? (
                    <FIFOBlock editable value={block.content} onChange={value => updateBlock(block.id, value)} />
                  ) : block.type === 'question' ? (
                    <QuestionEditor value={block.content} onChange={value => updateBlock(block.id, value)} />
                  ) : (
                    <textarea
                      value={block.content}
                      onChange={e => updateBlock(block.id, e.target.value)}
                      rows={block.type === 'title' ? 2 : 4}
                    />
                  )}

                  {block.type === 'list' && <small>Каждая строка станет отдельным пунктом.</small>}
                </div>
              ) : (
                <>
                  {block.type === 'title' && (index === 0
                    ? <h2 className="theory-title">{block.content}</h2>
                    : <h3>{block.content}</h3>)}
                  {block.type === 'text' && <p className="theory-text">{block.content}</p>}
                  {block.type === 'list' && (
                    <ul className="theory-list">
                      {block.content.split('\n').filter(Boolean).map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  )}
                  {block.type === 'graph' && <GraphBlock value={block.content} />}
                  {block.type === 'fifo' && <FIFOBlock value={block.content} />}
                  {block.type === 'question' && (
                    <QuestionBlock
                      value={block.content}
                      completed={!!correctQuestions[block.id]}
                      onCorrectChange={(correct) => {
                        if (correct) {
                          setCorrectQuestions(current => ({ ...current, [block.id]: true }))
                        }
                      }}
                    />
                  )}
                </>
              )}
            </article>
          ))}
        </section>
      </section>

      {navigationMessage && section === 'theory' && activeSlide === 1 && (
        <div
          style={{
            margin: '16px auto',
            padding: '12px 16px',
            maxWidth: 720,
            borderRadius: 10,
            background: '#fff3cd',
            border: '1px solid #e6c86e',
            color: '#5f4600',
            textAlign: 'center',
            fontWeight: 600,
          }}
        >
          {navigationMessage}
        </div>
      )}

      <section className="bottom-slide-navigation">
        <button className="button" disabled={activeSlide === 0} onClick={previousSlide}>← Назад</button>
        <span>{activeSlide + 1} / {slides.length}</span>
        <button className="button" disabled={activeSlide === slides.length - 1} onClick={nextSlide}>Далее →</button>
      </section>

      <footer>GraphEdu <span>· Учись понимать алгоритмы</span></footer>
    </main>
  )
}

export default App
