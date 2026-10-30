import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

type Vertex = {
  id: string
  label: string
  color: string
  x: number
  y: number
}

type Edge = [string, string]

type ViewMode = 'static' | 'bfs' | 'dfs' | 'components' | 'cycles' | 'dijkstra' | 'mst' | 'prim' | 'bellmanFord' | 'floydWarshall'
type GraphData = {
  vertices: Vertex[]
  edges: Edge[]
  viewMode: ViewMode
  weights?: Record<string, number>
  directed?: boolean
}

type Step = {
  description: string
  queue: string[]
  visited: string[]
  current: string | null
  order: string[]
  exploredEdges: string[]
  stack?: string[]
  distances?: Record<string, number>
  selectedEdges?: string[]
  totalWeight?: number
  matrix?: { labels: string[]; values: number[][] }
}

type Props = {
  editable?: boolean
  value?: string
  onChange?: (value: string) => void
}

const defaultColors = ['#e8eefc', '#e8f5e9', '#fff3cd', '#fce8e8', '#eee7f8', '#e5f5f6']

function getTextColor(background: string) {
  const hex = background.replace('#', '')

  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return '#1f2937'
  }

  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)

  // Для светлых/ярких цветов используем тёмный текст,
  // для тёмных цветов — белый.
  const brightness = (r * 299 + g * 587 + b * 114) / 1000

  return brightness > 155 ? '#1f2937' : '#ffffff'
}

const initialVertices: Vertex[] = [
  { id: 'A', label: 'A', color: '#e8eefc', x: 250, y: 45 },
  { id: 'B', label: 'B', color: '#e8f5e9', x: 145, y: 125 },
  { id: 'C', label: 'C', color: '#fff3cd', x: 355, y: 125 },
  { id: 'D', label: 'D', color: '#fce8e8', x: 75, y: 235 },
  { id: 'E', label: 'E', color: '#eee7f8', x: 205, y: 235 },
  { id: 'F', label: 'F', color: '#e5f5f6', x: 395, y: 235 },
  { id: 'G', label: 'G', color: '#e8eefc', x: 260, y: 335 },
]

const initialEdges: Edge[] = [
  ['A', 'B'],
  ['A', 'C'],
  ['B', 'D'],
  ['B', 'E'],
  ['C', 'F'],
  ['E', 'G'],
]

const defaultGraph: GraphData = {
  vertices: initialVertices,
  edges: initialEdges,
  viewMode: 'bfs',
}

function readGraph(value?: string): GraphData {
  if (value) {
    try {
      const data = JSON.parse(value) as Partial<GraphData>

      if (
        Array.isArray(data.vertices) &&
        Array.isArray(data.edges) &&
        data.vertices.every(
          (v: any) =>
            v &&
            typeof v.id === 'string' &&
            Number.isFinite(v.x) &&
            Number.isFinite(v.y),
        ) &&
        data.edges.every(
          (e: any) =>
            Array.isArray(e) &&
            e.length === 2 &&
            e.every((id: unknown) => typeof id === 'string'),
        )
      ) {
        const vertices: Vertex[] = data.vertices.map((v: any, index: number) => ({
          id: v.id,
          label: typeof v.label === 'string' ? v.label : v.id,
          color:
            typeof v.color === 'string' && v.color.trim()
              ? v.color
              : defaultColors[index % defaultColors.length],
          x: v.x,
          y: v.y,
        }))

        return {
          vertices,
          edges: data.edges.filter(
            ([a, b]) =>
              a !== b &&
              vertices.some((v) => v.id === a) &&
              vertices.some((v) => v.id === b),
          ),
          viewMode: ['static','bfs','dfs','components','cycles','dijkstra','mst','prim','bellmanFord','floydWarshall'].includes(String(data.viewMode)) ? data.viewMode as ViewMode : 'bfs',
          weights: data.weights && typeof data.weights === 'object' ? data.weights : {},
          directed: data.directed === true,
        }
      }
    } catch {
      // Используем стандартный граф.
    }
  }

  return defaultGraph
}

function buildBfs(vertices: Vertex[], edges: Edge[], start: string, directed = false): Step[] {
  if (!vertices.length) {
    return [{
      description: 'Добавь вершины, чтобы начать обход.',
      queue: [],
      visited: [],
      current: null,
      order: [],
      exploredEdges: [],
    }]
  }

  const adjacency = new Map<string, string[]>()
  vertices.forEach(({ id }) => adjacency.set(id, []))

  edges.forEach(([a, b]) => {
    adjacency.get(a)?.push(b)
    if (!directed) adjacency.get(b)?.push(a)
  })

  adjacency.forEach((neighbors) => neighbors.sort())

  const queue = [start]
  const visited = new Set([start])
  const order: string[] = []
  const exploredEdges = new Set<string>()
  const steps: Step[] = []

  const labelOf = (id: string) =>
    vertices.find((vertex) => vertex.id === id)?.label ?? id

  const edgeKey = (a: string, b: string) => [a, b].sort().join('|')

  const snapshot = (description: string, current: string | null) => {
    steps.push({
      description,
      queue: [...queue],
      visited: [...visited],
      current,
      order: [...order],
      exploredEdges: [...exploredEdges],
    })
  }

  snapshot(`Начинаем BFS из вершины ${labelOf(start)}.`, null)

  while (queue.length > 0) {
    const current = queue.shift()!
    order.push(current)
    snapshot(`Извлекаем ${labelOf(current)} из очереди.`, current)

    for (const neighbor of adjacency.get(current) ?? []) {
      if (visited.has(neighbor)) continue

      visited.add(neighbor)
      queue.push(neighbor)
      exploredEdges.add(edgeKey(current, neighbor))

      snapshot(
        `Находим ${labelOf(neighbor)} из ${labelOf(current)} и добавляем в очередь.`,
        current,
      )
    }
  }

  snapshot('Обход завершён: очередь пуста.', null)
  return steps
}

const edgeKey = (a: string, b: string) => [a, b].sort().join('|')

function buildAlgorithmSteps(mode: ViewMode, vertices: Vertex[], edges: Edge[], start: string, weights: Record<string, number> = {}, directed = false): Step[] {
  if (mode === 'bfs' || mode === 'static') return buildBfs(vertices, edges, start, directed)
  if (!vertices.length) return [{ description: 'Добавь вершины, чтобы начать алгоритм.', queue: [], visited: [], current: null, order: [], exploredEdges: [] }]
  const adjacency = new Map<string, string[]>()
  vertices.forEach(v => adjacency.set(v.id, []))
  edges.forEach(([a,b]) => { adjacency.get(a)?.push(b); if (!directed) adjacency.get(b)?.push(a) })
  adjacency.forEach(ns => ns.sort())
  const label = (id: string) => vertices.find(v => v.id === id)?.label ?? id
  const weight = (a: string,b: string) => weights[edgeKey(a,b)] ?? (Math.max(0, edges.findIndex(([x,y]) => edgeKey(x,y) === edgeKey(a,b))) % 7) + 1
  const steps: Step[] = []
  const visited = new Set<string>(), order: string[] = [], explored = new Set<string>()
  const snap = (description: string, current: string | null, queue: string[] = [], stack: string[] = [], distances?: Record<string, number>, selectedEdges: string[] = [], totalWeight?: number, matrix?: { labels: string[]; values: number[][] }) => steps.push({ description, queue: [...queue], stack: [...stack], visited: [...visited], current, order: [...order], exploredEdges: [...explored], distances: distances ? {...distances} : undefined, selectedEdges: [...selectedEdges], totalWeight, matrix: matrix ? { labels: [...matrix.labels], values: matrix.values.map(row => [...row]) } : undefined })
  const first = vertices.some(v => v.id === start) ? start : vertices[0].id
  if (mode === 'dfs' || mode === 'cycles' || mode === 'components') {
    const roots = mode === 'components' ? vertices.map(v => v.id) : [first]
    let component = 0, foundCycle = false
    const parent = new Map<string,string>()
    snap(mode === 'components' ? 'Перебираем вершины и ищем новую компоненту.' : `Начинаем ${mode === 'cycles' ? 'поиск цикла' : 'DFS'} из ${label(first)}.`, null)
    const visit = (v: string, stack: string[]) => {
      visited.add(v); order.push(v); stack.push(v)
      snap(`Посещаем ${label(v)} и углубляемся в первый непосещённый сосед.`, v, [], stack)
      for (const u of adjacency.get(v) ?? []) {
        explored.add(edgeKey(v,u))
        if (!visited.has(u)) { parent.set(u,v); visit(u, stack) }
        else if (parent.get(v) !== u && (mode === 'cycles' || mode === 'components')) {
          if (mode === 'cycles') { foundCycle = true; snap(`Обнаружено обратное ребро между ${label(v)} и ${label(u)}: в неориентированном графе найден цикл.`, v, [], stack) }
        }
      }
      stack.pop()
      snap(`У ${label(v)} не осталось непосещённых соседей — возвращаемся назад.`, v, [], stack)
    }
    for (const root of roots) {
      if (visited.has(root)) continue
      if (mode === 'components') { component++; snap(`Начинаем компоненту №${component} из ${label(root)}.`, root) }
      visit(root, [])
      if (mode !== 'components') break
    }
    if (mode === 'components') snap(`Готово: найдено компонент связности — ${component}.`, null)
    else if (mode === 'cycles') snap(foundCycle ? 'Поиск завершён: цикл найден.' : 'Поиск завершён: цикл не найден в достижимой части графа.', null)
    else snap('Обход DFS завершён.', null)
    return steps
  }
  if (mode === 'mst') {
    const parent = new Map(vertices.map(v => [v.id, v.id]))
    const find = (x: string): string => { const p = parent.get(x)!; if (p === x) return x; const root = find(p); parent.set(x,root); return root }
    const sorted = [...edges].sort((a,b) => weight(...a)-weight(...b))
    const chosen: string[] = []; let total = 0
    snap('Сортируем рёбра по возрастанию веса и начинаем алгоритм Краскала.', null, [], [], undefined, chosen, total)
    for (const [a,b] of sorted) {
      const key = edgeKey(a,b)
      if (find(a) !== find(b)) {
        parent.set(find(a), find(b)); chosen.push(key); total += weight(a,b); explored.add(key)
        snap(`Добавляем ребро ${label(a)}–${label(b)} весом ${weight(a,b)}: цикл не образуется.`, b, [], [], undefined, chosen, total)
      } else {
        explored.add(key)
        snap(`Пропускаем ребро ${label(a)}–${label(b)}: оно образовало бы цикл.`, b, [], [], undefined, chosen, total)
      }
      if (chosen.length === Math.max(0, vertices.length - 1)) break
    }
    snap(`Готово: вес найденного остовного леса — ${total}.`, null, [], [], undefined, chosen, total)
    return steps
  }
  if (mode === 'prim') {
    const chosen: string[] = []; let total = 0
    const inTree = new Set<string>([first])
    snap(`Начинаем алгоритм Прима из ${label(first)}. Выбираем минимальное ребро, выходящее из уже построенного дерева.`, first, [], [], undefined, chosen, total)
    while (inTree.size < vertices.length) {
      let best: Edge | null = null; let bestWeight = Infinity
      for (const [a,b] of edges) {
        const crosses = (inTree.has(a) && !inTree.has(b)) || (inTree.has(b) && !inTree.has(a))
        if (crosses && weight(a,b) < bestWeight) { best = [a,b]; bestWeight = weight(a,b) }
      }
      if (!best) {
        const nextRoot = vertices.find(v => !inTree.has(v.id))?.id
        if (!nextRoot) break
        inTree.add(nextRoot)
        snap(`Граф несвязный: продолжаем построение леса из ${label(nextRoot)}.`, nextRoot, [], [], undefined, chosen, total)
        continue
      }
      const [a,b] = best; const from = inTree.has(a) ? a : b; const to = from === a ? b : a
      inTree.add(to); chosen.push(edgeKey(a,b)); total += bestWeight; explored.add(edgeKey(a,b))
      snap(`Добавляем минимальное ребро ${label(from)}–${label(to)} весом ${bestWeight}.`, to, [], [], undefined, chosen, total)
    }
    snap(`Прим завершён. Общий вес построенного остовного леса: ${total}.`, null, [], [], undefined, chosen, total)
    return steps
  }
  // Dijkstra, Bellman–Ford and Floyd–Warshall use weighted edge relaxation.
  const dist: Record<string, number> = Object.fromEntries(vertices.map(v => [v.id, Infinity])); dist[first] = 0
  snap(`Инициализируем расстояния: от ${label(first)} до самой себя — 0, до остальных — ∞.`, first, [], [], dist)
  if (mode === 'dijkstra') {
    const done = new Set<string>()
    while (done.size < vertices.length) {
      const v = vertices.map(x => x.id).filter(id => !done.has(id)).sort((a,b) => dist[a]-dist[b])[0]
      if (!v || !Number.isFinite(dist[v])) break
      done.add(v); visited.add(v); order.push(v)
      snap(`Выбираем непосещённую вершину ${label(v)} с минимальным расстоянием ${dist[v]}.`, v, [], [], dist)
      for (const u of adjacency.get(v) ?? []) {
        const candidate = dist[v] + weight(v,u); explored.add(edgeKey(v,u))
        if (candidate < dist[u]) { dist[u] = candidate; snap(`Улучшаем расстояние до ${label(u)}: ${dist[u]}.`, v, [], [], dist) }
      }
    }
    snap('Алгоритм Дейкстры завершён.', null, [], [], dist)
  } else if (mode === 'bellmanFord') {
    for (let pass = 1; pass < vertices.length; pass++) {
      let changed = false
      for (const [a,b] of edges) for (const [u,v] of (directed ? [[a,b]] : [[a,b],[b,a]]) as Edge[]) {
        if (Number.isFinite(dist[u]) && dist[u] + weight(u,v) < dist[v]) { dist[v] = dist[u] + weight(u,v); changed = true; explored.add(edgeKey(u,v)); snap(`Проход ${pass}: расслабляем ${label(u)}–${label(v)}, расстояние до ${label(v)} = ${dist[v]}.`, u, [], [], dist) }
      }
      if (!changed) break
    }
    snap('Все проходы завершены: расстояния стабилизировались.', null, [], [], dist)
  } else {
    // Floyd–Warshall: show the pivot vertex for each relaxation.
    const matrix: Record<string, Record<string, number>> = {}
    vertices.forEach(v => { matrix[v.id] = {}; vertices.forEach(u => matrix[v.id][u.id] = v.id === u.id ? 0 : Infinity) })
    edges.forEach(([a,b]) => { matrix[a][b] = Math.min(matrix[a][b], weight(a,b)); if (!directed) matrix[b][a] = Math.min(matrix[b][a], weight(a,b)) })
    for (const k of vertices) {
      for (const i of vertices) for (const j of vertices) {
        const candidate = matrix[i.id][k.id] + matrix[k.id][j.id]
        if (candidate < matrix[i.id][j.id]) matrix[i.id][j.id] = candidate
      }
      const row = Object.fromEntries(vertices.map(v => [v.id, matrix[first][v.id]]))
      snap(`Фиксируем промежуточную вершину k = ${label(k.id)} и обновляем всю матрицу: dist[i][j] = min(dist[i][j], dist[i][k] + dist[k][j]).`, k.id, [], [], row, [], undefined, { labels: vertices.map(v => label(v.id)), values: vertices.map(i => vertices.map(j => matrix[i.id][j.id])) })
    }
    snap('Матрица кратчайших расстояний между всеми парами рассчитана.', null, [], [], Object.fromEntries(vertices.map(v => [v.id,matrix[first][v.id]])), [], undefined, { labels: vertices.map(v => label(v.id)), values: vertices.map(i => vertices.map(j => matrix[i.id][j.id])) })
  }
  return steps
}

function GraphBlock({ editable = false, value, onChange }: Props) {
  const graph = useMemo(() => readGraph(value), [value])
  const [start, setStart] = useState('A')
  const [stepIndex, setStepIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1000)
  const [tool, setTool] = useState<'move' | 'vertex' | 'edge' | 'delete'>('move')
  const [selectedVertex, setSelectedVertex] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)

  // Анимация очереди FIFO:
  // - новая вершина появляется слева направо;
  // - существующие элементы плавно сдвигаются влево,
  //   когда первый элемент выходит из очереди.
  const queueRefs = useRef<Record<string, HTMLSpanElement | null>>({})
  const previousQueuePositions = useRef<Map<string, DOMRect>>(new Map())

  const vertices = graph.vertices
  const edges = graph.edges
  const currentStart = vertices.some((v) => v.id === start)
    ? start
    : vertices[0]?.id ?? ''

  const steps = useMemo(
    () => buildAlgorithmSteps(graph.viewMode, vertices, edges, currentStart, graph.weights, graph.directed),
    [graph.viewMode, graph.weights, graph.directed, vertices, edges, currentStart],
  )

  const step = steps[Math.min(stepIndex, steps.length - 1)] ?? { description: '', queue: [], visited: [], current: null, order: [], exploredEdges: [] }
  const weightedMode = ['dijkstra','mst','prim','bellmanFord','floydWarshall'].includes(graph.viewMode)
  const modeNames: Record<ViewMode, string> = { static: 'Граф', bfs: 'BFS', dfs: 'DFS', components: 'Компоненты', cycles: 'Поиск циклов', dijkstra: 'Дейкстра', mst: 'MST / Краскал', prim: 'Прим', bellmanFord: 'Беллман — Форд', floydWarshall: 'Флойд — Уоршелл' }

  const labelOf = (id: string) =>
    vertices.find((vertex) => vertex.id === id)?.label ?? id

  useLayoutEffect(() => {
    const nextPositions = new Map<string, DOMRect>()

    step.queue.forEach((id) => {
      const element = queueRefs.current[id]
      if (!element) return

      const newRect = element.getBoundingClientRect()
      nextPositions.set(id, newRect)

      const oldRect = previousQueuePositions.current.get(id)

      // Вершина появилась в очереди: плавно въезжает слева.
      if (!oldRect) {
        element.getAnimations().forEach((animation) => animation.cancel())

        element.animate(
          [
            {
              opacity: 0,
              transform: 'translate3d(-18px, 0, 0) scale(0.82)',
            },
            {
              opacity: 1,
              transform: 'translate3d(0, 0, 0) scale(1)',
            },
          ],
          {
            duration: 360,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'both',
          },
        )
        return
      }

      const dx = oldRect.left - newRect.left
      const dy = oldRect.top - newRect.top

      // Элемент остался в очереди, но его позиция изменилась:
      // проигрываем FLIP-анимацию от старой позиции к новой.
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        element.getAnimations().forEach((animation) => animation.cancel())

        element.animate(
          [
            {
              transform: `translate3d(${dx}px, ${dy}px, 0)`,
            },
            {
              transform: 'translate3d(0, 0, 0)',
            },
          ],
          {
            duration: 420,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'none',
          },
        )
      }
    })

    previousQueuePositions.current = nextPositions
  }, [step.queue])

  useEffect(() => {
    setStepIndex(0)
    setPlaying(false)
  }, [value])

  useEffect(() => {
    if (!playing) return

    if (stepIndex >= steps.length - 1) {
      setPlaying(false)
      return
    }

    const timer = window.setTimeout(
      () => setStepIndex((n) => n + 1),
      speed,
    )

    return () => window.clearTimeout(timer)
  }, [playing, stepIndex, speed, steps.length])

  function saveGraph(next: GraphData) {
    onChange?.(JSON.stringify(next))
  }

  function updateGraph(changes: Partial<GraphData>) {
    saveGraph({ ...graph, ...changes })
  }

  function updateVertex(id: string, changes: Partial<Vertex>) {
    updateGraph({
      vertices: vertices.map((vertex) =>
        vertex.id === id ? { ...vertex, ...changes } : vertex,
      ),
    })
  }

  function nextVertexId() {
    let n = 0
    while (
      vertices.some((v) => v.id === String.fromCharCode(65 + n)) &&
      n < 26
    ) {
      n++
    }
    return n < 26 ? String.fromCharCode(65 + n) : `V${n + 1}`
  }

  function pointFromEvent(
    event: React.MouseEvent<SVGSVGElement> | React.PointerEvent<SVGSVGElement>,
  ) {
    const rect = event.currentTarget.getBoundingClientRect()

    return {
      x: Math.max(25, Math.min(475, (event.clientX - rect.left) * 500 / rect.width)),
      y: Math.max(25, Math.min(365, (event.clientY - rect.top) * 390 / rect.height)),
    }
  }

  function canvasClick(event: React.MouseEvent<SVGSVGElement>) {
    if (!editable || tool !== 'vertex') return
    if (event.target !== event.currentTarget) return

    const point = pointFromEvent(event)
    const id = nextVertexId()

    updateGraph({
      vertices: [
        ...vertices,
        {
          id,
          label: id,
          color: defaultColors[vertices.length % defaultColors.length],
          ...point,
        },
      ],
    })
  }

  function vertexClick(id: string) {
    if (!editable) return

    if (tool === 'edge') {
      if (!selectedVertex) {
        setSelectedVertex(id)
        return
      }

      if (selectedVertex === id) {
        setSelectedVertex(null)
        return
      }

      const exists = edges.some(
        ([a, b]) =>
          (a === selectedVertex && b === id) ||
          (a === id && b === selectedVertex),
      )

      updateGraph({
        edges: exists
          ? edges.filter(
              ([a, b]) =>
                !(
                  (a === selectedVertex && b === id) ||
                  (a === id && b === selectedVertex)
                ),
            )
          : [...edges, [selectedVertex, id]],
      })

      setSelectedVertex(null)
      return
    }

    if (tool === 'delete') {
      updateGraph({
        vertices: vertices.filter((v) => v.id !== id),
        edges: edges.filter(([a, b]) => a !== id && b !== id),
      })
      setSelectedVertex(null)
    }
  }

  function moveVertex(event: React.PointerEvent<SVGSVGElement>) {
    if (!dragging || !editable || tool !== 'move') return

    const point = pointFromEvent(event)

    updateGraph({
      vertices: vertices.map((v) =>
        v.id === dragging ? { ...v, ...point } : v,
      ),
    })
  }

  return (
    <section className="graph-card">
      <div className="graph-heading">
        <div>
          <span className="graph-eyebrow">
            {editable ? 'КОНСТРУКТОР ГРАФОВ' : 'ИНТЕРАКТИВНАЯ МОДЕЛЬ'}
          </span>
          <h3>Граф</h3>
        </div>
        <span className="graph-badge">
          {modeNames[graph.viewMode]}
        </span>
      </div>

      {editable && (
        <>
          <div className="graph-modes graph-mode-picker">
            {(['static','bfs','dfs','components','cycles','dijkstra','mst','prim','bellmanFord','floydWarshall'] as ViewMode[]).map(mode => <button key={mode} className={graph.viewMode === mode ? 'selected' : ''} onClick={() => { updateGraph({ viewMode: mode }); setPlaying(false); setStepIndex(0) }}>{modeNames[mode]}</button>)}
          </div>
          <div className="graph-modes">
            <button className={graph.directed ? 'selected' : ''} onClick={() => updateGraph({ directed: !graph.directed })}>
              {graph.directed ? '✓ Ориентированный граф' : 'Неориентированный граф'}
            </button>
          </div>

          <div className="graph-modes">
            <button
              className={tool === 'move' ? 'selected' : ''}
              onClick={() => {
                setTool('move')
                setSelectedVertex(null)
              }}
            >
              Перемещать
            </button>
            <button
              className={tool === 'vertex' ? 'selected' : ''}
              onClick={() => {
                setTool('vertex')
                setSelectedVertex(null)
              }}
            >
              + Вершина
            </button>
            <button
              className={tool === 'edge' ? 'selected' : ''}
              onClick={() => {
                setTool('edge')
                setSelectedVertex(null)
              }}
            >
              Рёбра
            </button>
            <button
              className={tool === 'delete' ? 'selected' : ''}
              onClick={() => {
                setTool('delete')
                setSelectedVertex(null)
              }}
            >
              Удалить вершину
            </button>
          </div>

          <p className="graph-hint">
            {tool === 'vertex'
              ? 'Нажми на свободное место графа, чтобы добавить вершину.'
              : tool === 'edge'
                ? selectedVertex
                  ? `Теперь выбери вторую вершину для ${labelOf(selectedVertex)}. Повторный выбор пары удаляет ребро.`
                  : 'Выбери две вершины, чтобы создать или удалить ребро.'
                : tool === 'delete'
                  ? 'Нажми на вершину, чтобы удалить её вместе с рёбрами.'
                  : 'Перетаскивай вершины мышью, чтобы менять их расположение.'}
          </p>

          <div className="graph-vertex-editor">
            <div className="graph-vertex-editor-title">Вершины</div>

            {vertices.map((vertex) => (
              <div className="graph-vertex-editor-row" key={vertex.id}>
                <span className="graph-vertex-editor-id">{vertex.id}</span>

                <input
                  type="text"
                  value={vertex.label}
                  onChange={(event) =>
                    updateVertex(vertex.id, { label: event.target.value })
                  }
                  placeholder="Название"
                  aria-label={`Название вершины ${vertex.id}`}
                />

                <input
                  type="color"
                  value={vertex.color}
                  onChange={(event) =>
                    updateVertex(vertex.id, { color: event.target.value })
                  }
                  title="Цвет вершины"
                  aria-label={`Цвет вершины ${vertex.label}`}
                />
              </div>
            ))}
          </div>
          {weightedMode && edges.length > 0 && <div className="graph-vertex-editor graph-weight-editor">
            <div className="graph-vertex-editor-title">Веса рёбер · можно менять вручную</div>
            {edges.map(([a,b], index) => <label className="graph-weight-editor-row" key={`${a}-${b}`}>
              <span>{labelOf(a)} — {labelOf(b)}</span>
              <input type="number" step="1" value={graph.weights?.[edgeKey(a,b)] ?? (index % 7) + 1} onChange={event => { const raw = event.target.value; const value = raw === '' ? 0 : Number(raw); updateGraph({ weights: { ...(graph.weights || {}), [edgeKey(a,b)]: value } }); setStepIndex(0); setPlaying(false) }} aria-label={`Вес ребра ${labelOf(a)}–${labelOf(b)}`} />
            </label>)}
          </div>}
        </>
      )}

      {graph.viewMode !== 'static' && vertices.length > 0 && (
        <div className="graph-start">
          <label htmlFor="bfs-start">Стартовая вершина</label>
          <select
            id="graph-start"
            value={currentStart}
            onChange={(event) => {
              setPlaying(false)
              setStart(event.target.value)
              setStepIndex(0)
            }}
          >
            {vertices.map((vertex) => (
              <option value={vertex.id} key={vertex.id}>
                {vertex.label}
              </option>
            ))}
          </select>
          <span>Соседи обходятся по алфавиту; веса демонстрационные и редактируются ниже.</span>
        </div>
      )}

      <div className="graph-canvas">
        <svg
          viewBox="0 0 500 390"
          role="img"
          aria-label="Граф"
          onClick={canvasClick}
          onPointerMove={moveVertex}
          onPointerUp={() => setDragging(null)}
          onPointerLeave={() => setDragging(null)}
        >
          <defs><marker id="graph-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L6,3 z" fill="#7c91b4" /></marker></defs>
          {edges.map(([a, b]) => {
            const from = vertices.find((v) => v.id === a)
            const to = vertices.find((v) => v.id === b)
            if (!from || !to) return null

            const active =
              graph.viewMode !== 'static' &&
              step.exploredEdges.includes([a, b].sort().join('|'))

            return (
              <line
                key={`${a}-${b}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                markerEnd={graph.directed ? 'url(#graph-arrowhead)' : undefined}
                className={`${active ? 'graph-edge visited-edge' : 'graph-edge'} ${step.selectedEdges?.includes(edgeKey(a,b)) ? 'selected-edge' : ''}`}
              />
            )
          })}
          {weightedMode && edges.map(([a,b], index) => { const from = vertices.find(v => v.id === a), to = vertices.find(v => v.id === b); if (!from || !to) return null; return <text key={`weight-${a}-${b}`} x={(from.x+to.x)/2} y={(from.y+to.y)/2-7} className="graph-weight-label" textAnchor="middle">{graph.weights?.[edgeKey(a,b)] ?? (index % 7)+1}</text> })}

          {vertices.map((vertex) => {
            const visited =
              graph.viewMode !== 'static' &&
              step.visited.includes(vertex.id)
            const current =
              graph.viewMode !== 'static' &&
              step.current === vertex.id
            const isStart = currentStart === vertex.id

            return (
              <g
                key={vertex.id}
                style={{ cursor: editable ? 'pointer' : 'default' }}
                onClick={(event) => {
                  event.stopPropagation()
                  vertexClick(vertex.id)
                }}
                onPointerDown={(event) => {
                  if (editable && tool === 'move') {
                    event.preventDefault()
                    setDragging(vertex.id)
                  }
                }}
              >
                {current && (
                  <circle
                    cx={vertex.x}
                    cy={vertex.y}
                    r="29"
                    className="graph-pulse"
                  />
                )}

                <circle
                  cx={vertex.x}
                  cy={vertex.y}
                  r="23"
                  className={[
                    'graph-node',
                    visited ? 'node-visited' : '',
                    current ? 'node-current' : '',
                    graph.viewMode !== 'static' && isStart ? 'node-start' : '',
                    selectedVertex === vertex.id ? 'node-current' : '',
                  ].join(' ')}
                  style={{ fill: vertex.color }}
                />

                <text
                  x={vertex.x}
                  y={vertex.y + 5}
                  className="graph-node-label"
                  textAnchor="middle"
                  style={{
                    pointerEvents: 'none',
                    fill: getTextColor(vertex.color),
                  }}
                >
                  {vertex.label}
                </text>

                {graph.viewMode !== 'static' && isStart && (
                  <text
                    x={vertex.x}
                    y={vertex.y - 32}
                    className="graph-start-label"
                    textAnchor="middle"
                    style={{ pointerEvents: 'none' }}
                  >
                    START
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {graph.viewMode !== 'static' && (
        <>
          <div className="graph-step-info">
            <span>ШАГ {stepIndex} / {steps.length - 1}</span>
            <p>{step.description}</p>
          </div>

          <div className="graph-data">
            <div>
              <span className="data-label">{graph.viewMode === 'bfs' ? 'Очередь FIFO' : graph.viewMode === 'dfs' || graph.viewMode === 'cycles' ? 'Стек вызовов DFS' : (graph.viewMode === 'mst' || graph.viewMode === 'prim') ? 'Выбранные рёбра' : 'Состояние алгоритма'}</span>
              <div className="queue-items">
                {(graph.viewMode === 'bfs' ? step.queue : graph.viewMode === 'dfs' || graph.viewMode === 'cycles' ? (step.stack ?? []) : (graph.viewMode === 'mst' || graph.viewMode === 'prim') ? (step.selectedEdges ?? []) : []).length
                  ? (graph.viewMode === 'bfs' ? step.queue : graph.viewMode === 'dfs' || graph.viewMode === 'cycles' ? (step.stack ?? []) : (step.selectedEdges ?? [])).map((id) => (
                      <span className="queue-item" key={id}>{(graph.viewMode === 'mst' || graph.viewMode === 'prim') ? id.replace('|','–') : labelOf(id)}</span>
                    ))
                  : <span className="empty-data">—</span>}
              </div>
            </div>

            <div>
              <span className="data-label">{step.distances ? 'Расстояния от старта' : (graph.viewMode === 'mst' || graph.viewMode === 'prim') ? `Суммарный вес: ${step.totalWeight ?? 0}` : 'Порядок обхода'}</span>
              <p className="order-text">
                {step.distances ? Object.entries(step.distances).map(([id,d]) => `${labelOf(id)}: ${Number.isFinite(d) ? d : '∞'}`).join(' · ') : step.order.map(labelOf).join(' → ') || '—'}
              </p>
            </div>
          </div>

          {graph.viewMode === 'floydWarshall' && step.matrix && (
            <div className="floyd-matrix-wrap">
              <div className="data-label">Матрица расстояний после шага {stepIndex + 1}</div>
              <div className="floyd-matrix-scroll"><table className="floyd-matrix"><thead><tr><th>i\j</th>{step.matrix.labels.map((name) => <th key={name}>{name}</th>)}</tr></thead><tbody>{step.matrix.values.map((row, i) => <tr key={step.matrix!.labels[i]}><th>{step.matrix!.labels[i]}</th>{row.map((value, j) => <td key={j}>{Number.isFinite(value) ? value : '∞'}</td>)}</tr>)}</tbody></table></div>
            </div>
          )}

          <div className="graph-controls">
              <button
                onClick={() => {
                  setPlaying(false)
                  setStepIndex((n) => Math.max(0, n - 1))
                }}
                disabled={stepIndex === 0}
              >
                ← Назад
              </button>

              <button
                className="graph-play"
                onClick={() => {
                  if (stepIndex >= steps.length - 1) {
                    setStepIndex(0)
                    setPlaying(true)
                  } else {
                    setPlaying((v) => !v)
                  }
                }}
              >
                {playing ? 'Ⅱ Пауза' : '▶ Продолжить'}
              </button>

              <button
                onClick={() => {
                  setPlaying(false)
                  setStepIndex((n) => Math.min(n + 1, steps.length - 1))
                }}
                disabled={stepIndex >= steps.length - 1}
              >
                Далее →
              </button>

              <button
                onClick={() => {
                  setPlaying(false)
                  setStepIndex(0)
                }}
              >
                Сброс
              </button>
          </div>

          <div className="graph-speed">
              <label htmlFor="bfs-speed">Скорость анимации</label>
              <select
                id="graph-speed"
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
              >
                <option value={1800}>Медленно</option>
                <option value={1000}>Нормально</option>
                <option value={400}>Быстро</option>
              </select>
          </div>
        </>
      )}
    </section>
  )
}

export default GraphBlock
