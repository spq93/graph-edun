export type Block = { id: string; type: 'title' | 'text' | 'list' | 'code' | 'graph' | 'grid' | 'fifo' | 'question'; content: string }
export type Slide = { id: string; title: string; blocks: Block[] }
export type Course = { id: string; title: string; description: string; theorySlides: Slide[]; visualizationSlides: Slide[]; theoryCompleted: boolean; tasksCompleted: boolean }
