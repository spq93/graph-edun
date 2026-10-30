import { useEffect, useMemo, useState } from 'react'

type FIFOData = {
  items: string[]
  speed: number
}

type Props = {
  editable?: boolean
  value: string
  onChange?: (value: string) => void
}

const parseData = (value: string): FIFOData => {
  try {
    const parsed = JSON.parse(value)

    return {
      items: Array.isArray(parsed.items)
        ? parsed.items.map((item: unknown) => String(item))
        : ['1', '2', '3', '4'],
      speed: Number(parsed.speed) || 900,
    }
  } catch {
    return {
      items: ['1', '2', '3', '4'],
      speed: 900,
    }
  }
}

export default function FIFOBlock({ editable = false, value, onChange }: Props) {
  const data = useMemo(() => parseData(value), [value])

  const [queue, setQueue] = useState<string[]>(data.items)
  const [speed, setSpeed] = useState(data.speed)
  const [current, setCurrent] = useState(0)
  const [removed, setRemoved] = useState<string[]>([])
  const [running, setRunning] = useState(false)

  useEffect(() => {
    setQueue(data.items)
    setSpeed(data.speed)
    setCurrent(0)
    setRemoved([])
    setRunning(false)
  }, [value])

  const saveData = (nextItems: string[], nextSpeed = speed) => {
    onChange?.(
      JSON.stringify({
        items: nextItems,
        speed: nextSpeed,
      }),
    )
  }

  const updateItem = (index: number, text: string) => {
    const next = [...queue]
    next[index] = text
    setQueue(next)
    saveData(next)
  }

  const addItem = () => {
    const next = [...queue, '']
    setQueue(next)
    saveData(next)
  }

  const removeItem = (index: number) => {
    if (queue.length <= 1) return

    const next = queue.filter((_, i) => i !== index)
    setQueue(next)
    saveData(next)
  }

  const changeSpeed = (nextSpeed: number) => {
    setSpeed(nextSpeed)
    saveData(queue, nextSpeed)
  }

  const reset = () => {
    setCurrent(0)
    setRemoved([])
    setRunning(false)
  }

  const stepForward = () => {
    if (current >= queue.length) return

    setRemoved((prev) => [...prev, queue[current]])
    setCurrent((prev) => prev + 1)
  }

  const stepBack = () => {
    if (current <= 0) return

    setCurrent((prev) => prev - 1)
    setRemoved((prev) => prev.slice(0, -1))
  }

  useEffect(() => {
    if (!running || current >= queue.length) {
      if (current >= queue.length) setRunning(false)
      return
    }

    const timer = window.setTimeout(stepForward, speed)
    return () => window.clearTimeout(timer)
  }, [running, current, queue, speed])

  if (editable) {
    return (
      <div className="fifo-editor">
        <h3>Настройка FIFO</h3>

        <div className="fifo-editor-items">
          <div className="fifo-editor-label">Элементы очереди:</div>

          {queue.map((item, index) => (
            <div className="fifo-editor-row" key={index}>
              <span className="fifo-editor-number">{index + 1}.</span>

              <input
                type="text"
                value={item}
                onChange={(e) => updateItem(index, e.target.value)}
                placeholder={`Элемент ${index + 1}`}
              />

              <button
                type="button"
                className="fifo-remove-button"
                onClick={() => removeItem(index)}
                disabled={queue.length <= 1}
                title="Удалить элемент"
              >
                −
              </button>
            </div>
          ))}

          <button type="button" className="fifo-add-button" onClick={addItem}>
            + Добавить элемент
          </button>
        </div>

        <label className="fifo-speed-label">
          Скорость анимации:
          <select
            value={speed}
            onChange={(e) => changeSpeed(Number(e.target.value))}
          >
            <option value={1400}>Медленно</option>
            <option value={900}>Средне</option>
            <option value={450}>Быстро</option>
          </select>
        </label>

        <div className="fifo-preview">
          <strong>Предпросмотр:</strong>{' '}
          {queue.length > 0 ? queue.map((item, i) => (
            <span key={i}>
              {i > 0 ? ' → ' : ''}
              {item || 'пусто'}
            </span>
          )) : 'очередь пуста'}
        </div>
      </div>
    )
  }

  return (
    <div className="fifo-block">
      <div className="fifo-header">
        <h3>FIFO — очередь</h3>
        <span>Первым вошёл — первым вышел</span>
      </div>

      <div className="fifo-visual">
        <div className="fifo-side-label">Выход</div>

        <div className="fifo-queue">
          {queue.slice(current).map((item, visibleIndex) => {
            const index = current + visibleIndex
            const isHead = visibleIndex === 0

            return (
              <div
                className={`fifo-item ${isHead ? 'fifo-item-head' : ''}`}
                key={index}
              >
                {item || 'пусто'}
              </div>
            )
          })}
        </div>

        <div className="fifo-side-label">Вход</div>
      </div>

      <div className="fifo-info">
        {current < queue.length ? (
          <>
            <strong>Первый в очереди:</strong>{' '}
            {queue[current] || 'пустой элемент'}
          </>
        ) : (
          <strong>Очередь полностью обработана.</strong>
        )}
      </div>

      <div className="fifo-removed">
        <strong>Извлечено:</strong>{' '}
        {removed.length > 0 ? removed.join(' → ') : 'ничего'}
      </div>

      <div className="fifo-progress">
        <div
          className="fifo-progress-bar"
          style={{
            width: `${queue.length ? (current / queue.length) * 100 : 0}%`,
          }}
        />
      </div>

      <div className="fifo-controls">
        <button type="button" onClick={stepBack} disabled={current <= 0}>
          ← Назад
        </button>

        <button
          type="button"
          onClick={() => setRunning((prev) => !prev)}
          disabled={current >= queue.length}
        >
          {running ? 'Ⅱ Пауза' : '▶ Запустить'}
        </button>

        <button
          type="button"
          onClick={stepForward}
          disabled={current >= queue.length}
        >
          Далее →
        </button>

        <button type="button" onClick={reset}>
          Сброс
        </button>
      </div>

      <div className="fifo-explanation">
        {current === 0 &&
          'Нажми «Далее» или «Запустить», чтобы извлечь первый элемент.'}

        {current > 0 &&
          current < queue.length &&
          `Элемент «${queue[current - 1]}» вышел первым. Теперь очередь обрабатывает «${queue[current]}».`}

        {current >= queue.length &&
          'Все элементы вышли из очереди в том же порядке, в котором вошли.'}
      </div>
    </div>
  )
}
