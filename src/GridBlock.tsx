import { useEffect, useMemo, useState } from 'react'

type GridData = { cells: number[][]; start: [number, number]; viewMode: 'floodFill' | 'static'; algorithm?: 'bfs' | 'dfs' }
type Props = { editable?: boolean; value?: string; onChange?: (value: string) => void }
const defaultCells = [
  [1,1,1,1,1,1,1,1],
  [1,0,0,0,1,0,0,1],
  [1,0,1,0,1,0,1,1],
  [1,0,1,0,0,0,0,1],
  [1,0,0,0,1,1,0,1],
  [1,1,1,1,1,1,1,1],
]
const fallback: GridData = { cells: defaultCells, start: [1,1], viewMode: 'floodFill' }
function readGrid(value?: string): GridData {
  try {
    if (!value) return fallback
    const data = JSON.parse(value)
    if (Array.isArray(data.cells) && data.cells.length > 0 && data.cells.every((row: unknown) => Array.isArray(row))) {
      return { cells: data.cells.map((row: unknown[]) => row.map((cell) => Number(cell) === 1 ? 1 : 0)), start: Array.isArray(data.start) ? [Number(data.start[0]) || 0, Number(data.start[1]) || 0] : [1,1], viewMode: data.viewMode === 'static' ? 'static' : 'floodFill', algorithm: data.algorithm === 'dfs' ? 'dfs' : 'bfs' }
    }
  } catch { /* use default grid */ }
  return fallback
}
function getFloodOrder(cells: number[][], start: [number, number], algorithm: 'bfs' | 'dfs') {
  const rows = cells.length
  const [sr, sc] = start
  if (sr < 0 || sr >= rows || sc < 0 || sc >= (cells[sr]?.length ?? 0) || cells[sr][sc] !== 0) return [] as [number, number][]
  const pending: [number, number][] = [[sr, sc]], seen = new Set([`${sr},${sc}`]), order: [number, number][] = []
  const directions: [number, number][] = [[-1,0],[0,-1],[0,1],[1,0]]
  while (pending.length) {
    const [r,c] = algorithm === 'bfs' ? pending.shift()! : pending.pop()!
    order.push([r,c])
    for (const [dr,dc] of directions) {
      const nr = r + dr, nc = c + dc, key = `${nr},${nc}`
      if (nr < 0 || nr >= rows || nc < 0 || nc >= (cells[nr]?.length ?? 0) || cells[nr][nc] !== 0 || seen.has(key)) continue
      seen.add(key); pending.push([nr,nc])
    }
  }
  return order
}

export default function GridBlock({ editable = false, value, onChange }: Props) {
  const grid = useMemo(() => readGrid(value), [value])
  const [step, setStep] = useState(-1)
  const [algorithm, setAlgorithm] = useState<'bfs' | 'dfs'>(grid.algorithm ?? 'bfs')
  const order = useMemo(() => getFloodOrder(grid.cells, grid.start, algorithm), [grid, algorithm])
  useEffect(() => { setStep(-1); setAlgorithm(grid.algorithm ?? 'bfs') }, [value])
  const filled = new Set(order.slice(0, step + 1).map(([r,c]) => `${r},${c}`))
  const save = (next: GridData) => onChange?.(JSON.stringify(next))
  const maxCols = Math.max(0, ...grid.cells.map(row => row.length))
  return <section className="grid-model-card">
    <div className="grid-model-heading"><div><span className="grid-model-eyebrow">ИНТЕРАКТИВНАЯ МОДЕЛЬ</span><h3>Сетка и Flood Fill</h3></div><span className="graph-badge">{grid.viewMode === 'static' ? 'Сетка' : `Flood Fill · ${algorithm.toUpperCase()}`}</span></div>
    {editable && <div className="graph-modes">
      <button className={grid.viewMode === 'floodFill' ? 'selected' : ''} onClick={() => { save({...grid, viewMode:'floodFill'}); setStep(-1) }}>Flood Fill</button>
      <button className={grid.viewMode === 'static' ? 'selected' : ''} onClick={() => save({...grid, viewMode:'static'})}>Статичная сетка</button>

      <button onClick={() => { save({...grid, cells: defaultCells, start:[1,1], viewMode:'floodFill'}); setStep(-1) }}>Сбросить сетку</button>
    </div>}
    {grid.viewMode === 'floodFill' && <div className="grid-algorithm-row"><span>Алгоритм обхода</span><div className="grid-algorithm-options"><button type="button" className={algorithm === 'bfs' ? 'selected' : ''} onClick={() => { setAlgorithm('bfs'); save({...grid, algorithm:'bfs'}); setStep(-1) }}>BFS · в ширину</button><button type="button" className={algorithm === 'dfs' ? 'selected' : ''} onClick={() => { setAlgorithm('dfs'); save({...grid, algorithm:'dfs'}); setStep(-1) }}>DFS · в глубину</button></div></div>}
    {editable && <p className="graph-hint">Нажимай на клетки, чтобы переключать стену и свободную клетку. Старт заливки — зелёная клетка.</p>}
    <div className="grid-model-cells" style={{gridTemplateColumns:`repeat(${maxCols}, minmax(24px, 1fr))`}}>
      {grid.cells.map((row,r) => row.map((cell,c) => {
        const isStart = r === grid.start[0] && c === grid.start[1]
        const isFilled = grid.viewMode === 'floodFill' && filled.has(`${r},${c}`)
        const isCurrent = grid.viewMode === 'floodFill' && step >= 0 && order[step]?.[0] === r && order[step]?.[1] === c
        return <button type="button" key={`${r}-${c}`} disabled={!editable} aria-label={`Клетка ${r+1}, ${c+1}`} title={`(${r}, ${c})`} className={`grid-cell ${cell === 1 ? 'grid-wall' : 'grid-open'} ${isFilled ? 'grid-filled' : ''} ${isCurrent ? 'grid-current' : ''} ${isStart ? 'grid-start' : ''}`} onClick={() => {
          if (!editable) return
          const cells = grid.cells.map(line => [...line]); cells[r][c] = cells[r][c] === 1 ? 0 : 1
          save({...grid, cells}); setStep(-1)
        }}>{isStart ? 'S' : cell === 1 ? '■' : isCurrent ? '●' : isFilled ? '✓' : ''}</button>
      }))}
    </div>
    {grid.viewMode === 'floodFill' && <>
      <div className="graph-step-info"><span>ШАГ {Math.min(step + 1, order.length)} / {order.length}</span><p>{order.length ? step < 0 ? 'Готово к запуску: нажми «Далее», чтобы начать заливку.' : `${algorithm.toUpperCase()} посетил ${Math.min(step + 1, order.length)} из ${order.length} доступных клеток.` : 'Стартовая клетка заблокирована или находится вне сетки.'}</p></div>
      {!editable && <div className="graph-controls">
        <button disabled={step <= 0} onClick={() => setStep(s => Math.max(0,s-1))}>← Назад</button>
        <button className="graph-play" onClick={() => setStep(s => s >= order.length - 1 ? -1 : s + 1)}>Далее →</button>
        <button onClick={() => setStep(-1)}>Сброс</button>
      </div>}
      <p className="grid-model-legend"><span className="legend-chip grid-start-chip">S</span> старт <span className="legend-chip grid-filled-chip">✓</span> посещено <span className="legend-chip grid-current-chip">●</span> текущий шаг <span className="legend-chip grid-wall-chip">■</span> стена</p>
    </>}
  </section>
}
