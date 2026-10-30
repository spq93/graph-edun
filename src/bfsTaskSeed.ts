// Задания BFS из пользовательской резервной копии.
// Данные хранятся в исходниках и копируются в localStorage при первичной миграции.
export const bfsTaskSeed = [
  {
    "id": "bfs-task-1",
    "title": "Правило FIFO",
    "prompt": "Что означает принцип FIFO в очереди?",
    "type": "single",
    "options": [
      "Первым пришёл — первым вышел",
      "Последним пришёл — первым вышел",
      "Элементы извлекаются случайно",
      "Из очереди можно извлечь только один элемент"
    ],
    "correctIndexes": [
      0
    ],
    "acceptedAnswers": [],
    "hint": "Перечитайте второй слайд теории",
    "explanation": "FIFO означает First In, First Out: элемент, добавленный раньше остальных, будет извлечён первым.",
    "points": 1,
    "language": "cpp17",
    "starterCode": "#include <iostream>\nusing namespace std;\n\nint main() {\n    long long a, b;\n    cin >> a >> b;\n    cout << a + b << \"\\n\";\n    return 0;\n}",
    "testCases": []
  },
  {
    "id": "d5fca5dd-b042-462f-8f14-a5e171952056",
    "title": "Заполни пропуск",
    "prompt": "После обработки некоторой вершины, она _____ из очереди, после чего идет обработка следующей вершины в очереди",
    "type": "fillblank",
    "options": [],
    "correctIndexes": [],
    "acceptedAnswers": [
      "удаляется",
      "извлекается",
      "выходит",
      "уходит",
      "",
      ""
    ],
    "hint": "",
    "explanation": "",
    "points": 1
  },
  {
    "id": "bfs-task-2",
    "title": "Очередь после первого шага",
    "prompt": "В графе стартовая вершина A соединена с B и C. Алгоритм BFS обработал A и добавил её соседей в алфавитном порядке. Что находится в очереди?",
    "type": "single",
    "options": [
      "[A]",
      "[B, C]",
      "[A, B, C]",
      "Очередь пуста"
    ],
    "correctIndexes": [
      1
    ],
    "acceptedAnswers": [],
    "hint": "После обработки A она должна извлекаться",
    "explanation": "BFS извлекает A и помещает её непосещённых соседей в очередь. При алфавитном порядке сначала добавляется B, затем C: [B, C].",
    "points": 1,
    "language": "cpp17",
    "starterCode": "#include <iostream>\nusing namespace std;\n\nint main() {\n    long long a, b;\n    cin >> a >> b;\n    cout << a + b << \"\\n\";\n    return 0;\n}",
    "testCases": []
  },
  {
    "id": "bfs-task-3",
    "title": "Свойства BFS",
    "prompt": "Выбери все верные утверждения о поиске в ширину.",
    "type": "multiple",
    "options": [
      "Для обхода может использоваться очередь FIFO",
      "BFS в графе находит кратчайшие пути по числу рёбер",
      "Вершину удобно отмечать посещённой при добавлении в очередь",
      "Каждую найденную вершину нужно добавлять в очередь снова и снова",
      "BFS не может работать с цикличными графами"
    ],
    "correctIndexes": [
      0,
      1,
      2
    ],
    "acceptedAnswers": [],
    "hint": "Подумай, как FIFO влияет на порядок обработки вершин и зачем хранить отметку посещения.",
    "explanation": "BFS использует очередь FIFO, поэтому сначала обрабатывает ближайшие к старту вершины. В невзвешенном графе это позволяет найти минимальное расстояние по количеству рёбер. Отметка при добавлении в очередь не даёт добавить одну вершину несколько раз.",
    "points": 2,
    "language": "cpp17",
    "starterCode": "#include <iostream>\nusing namespace std;\n\nint main() {\n    long long a, b;\n    cin >> a >> b;\n    cout << a + b << \"\\n\";\n    return 0;\n}",
    "testCases": []
  },
  {
    "id": "1c24b442-ce86-450a-b47e-5983095c4416",
    "title": "Два утверждения",
    "prompt": "Даны два утверждения:\n\nA: Цикл представляет из себя такой путь, который не имеет конца\nB: При обходе графа в ширину НЕ нужно помещать стартовую вершину в FIFO",
    "type": "truefalse",
    "options": [
      "Верно только A",
      "Верно только B",
      "Верны оба утверждения",
      "Не верно ни одно из утверждений"
    ],
    "correctIndexes": [
      0
    ],
    "acceptedAnswers": [],
    "hint": "Будет ли хоть что-то обрабатываться, если не поместить стартовую вершину в FIFO?",
    "explanation": "Если не положить стартовую вершину в очередь, то она не будет обработана, следовательно не будут посещены ее дети, а это вряд-ли то, что нужно.",
    "points": 2
  },
  {
    "id": "bfs-task-4",
    "title": "Кратчайшее расстояние",
    "prompt": "В неориентированном графе есть рёбра A–B, A–C, B–D, B–E, C–F и E–G. Чему равно кратчайшее расстояние от A до G в количестве рёбер?",
    "type": "short",
    "options": [],
    "correctIndexes": [],
    "acceptedAnswers": [
      "3",
      "три",
      "3 ребра",
      "3 ребро"
    ],
    "hint": "Найди путь A → B → E → G и посчитай рёбра, а не вершины.",
    "explanation": "Кратчайший путь: A → B → E → G. В нём три ребра, поэтому расстояние равно 3.",
    "points": 2,
    "language": "cpp17",
    "starterCode": "#include <iostream>\nusing namespace std;\n\nint main() {\n    long long a, b;\n    cin >> a >> b;\n    cout << a + b << \"\\n\";\n    return 0;\n}",
    "testCases": []
  },
  {
    "id": "bfs-task-5",
    "title": "Порядок обхода",
    "prompt": "Для графа с рёбрами A–B, A–C, B–D, B–E, C–F и E–G запиши порядок обхода BFS из A. Соседи рассматриваются по алфавиту. Введи буквы через запятую.",
    "type": "short",
    "options": [],
    "correctIndexes": [],
    "acceptedAnswers": [
      "A, B, C, D, E, F, G",
      "A B C D E F G",
      "A→B→C→D→E→F→G",
      "A, B, C, D, E, F, G."
    ],
    "hint": "Сначала обрабатывается A, затем B и C. После B в очередь попадут D и E.",
    "explanation": "BFS посещает вершины по уровням. При обработке A открываются B и C; затем из B находятся D и E, из C — F, а из E — G. Итоговый порядок: A, B, C, D, E, F, G.",
    "points": 3,
    "language": "cpp17",
    "starterCode": "#include <iostream>\nusing namespace std;\n\nint main() {\n    long long a, b;\n    cin >> a >> b;\n    cout << a + b << \"\\n\";\n    return 0;\n}",
    "testCases": []
  },
  {
    "id": "bfs-task-code-1",
    "title": "Минимальное расстояние (необязательное)",
    "prompt": "Дан неориентированный граф из N вершин и M рёбер. Найди минимальное количество рёбер от вершины S до вершины T. Если пути нет, выведи -1. В первой строке N и M, затем M рёбер, в последней строке S и T.",
    "type": "programming",
    "options": [],
    "correctIndexes": [],
    "acceptedAnswers": [],
    "hint": "",
    "explanation": "BFS находит кратчайшее расстояние в невзвешенном графе. Если T недостижима, выведи -1.",
    "points": 5,
    "language": "cpp17",
    "starterCode": "",
    "testCases": [
      {
        "id": "bfs-path-1",
        "input": "5 4\n1 2\n2 3\n1 4\n4 5\n1 3\n",
        "expectedOutput": "2\n",
        "visible": true
      },
      {
        "id": "bfs-path-2",
        "input": "4 2 1 2 3 4 1 4",
        "expectedOutput": "-1",
        "visible": false
      },
      {
        "id": "bfs-path-3",
        "input": "3 3 1 2 2 3 1 3 1 3",
        "expectedOutput": "1",
        "visible": false
      },
      {
        "id": "bfs-path-4",
        "input": "1 0 1 1",
        "expectedOutput": "0",
        "visible": false
      }
    ]
  }
] as const
