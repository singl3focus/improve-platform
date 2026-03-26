# Методическое пособие: Архитектура графа дорожной карты

## Содержание

1. [Обзор системы](#1-обзор-системы)
2. [Модель данных](#2-модель-данных)
3. [Алгоритм раскладки (Layout)](#3-алгоритм-раскладки-layout)
4. [Рёберные соединения (Connections)](#4-рёберные-соединения-connections)
5. [Рендеринг: CSS Grid + SVG](#5-рендеринг-css-grid--svg)
6. [Zoom и Pan: навигация по сцене](#6-zoom-и-pan-навигация-по-сцене)
7. [Реактивный цикл обновления](#7-реактивный-цикл-обновления)
8. [Тестирование](#8-тестирование)
9. [Ключевые проектные решения](#9-ключевые-проектные-решения)

---

## 1. Обзор системы

Граф дорожной карты -- визуальное представление учебного плана в виде DAG (directed acyclic graph).
Каждая тема -- узел графа, рёбра -- зависимости между темами (prerequisite).
Пользователь видит карточки тем, расположенные на 2D-сетке, со стрелками-связями между ними.

### Архитектурные слои

```
┌──────────────────────────────────────────────────────────────────────┐
│  Данные: RoadmapResponse (topics + prerequisiteTopicIds)            │
├──────────────────────────────────────────────────────────────────────┤
│  Раскладка: buildTopicGridPlacementById → Map<id, {row, column}>   │
├──────────────────────────────────────────────────────────────────────┤
│  Рендеринг: CSS Grid (ul.roadmap-graph-nodes) + grid-row/column    │
├──────────────────────────────────────────────────────────────────────┤
│  Замеры: useRoadmapGraphLayout → getBoundingClientRect каждой карты │
├──────────────────────────────────────────────────────────────────────┤
│  Соединения: buildRoadmapConnections → [{x1,y1,x2,y2}]            │
├──────────────────────────────────────────────────────────────────────┤
│  Отрисовка рёбер: SVG <path> с кубическими безье-кривыми           │
├──────────────────────────────────────────────────────────────────────┤
│  Трансформации: translate(offsetX, offsetY) scale(scale)           │
└──────────────────────────────────────────────────────────────────────┘
```

Ключевой принцип -- **декомпозиция**: раскладка не знает про DOM, рёбра не знают про grid-позиции,
рендеринг не знает про алгоритм размещения. Каждый слой тестируется независимо.

### Карта файлов

| Файл | Назначение |
|---|---|
| `types.ts` | Типы данных: `RoadmapTopic`, `RoadmapStage`, `RoadmapResponse` |
| `lib/roadmap-layout.ts` | Алгоритм раскладки + построение рёбер |
| `lib/roadmap-graph.ts` | Утилиты графа: безье-кривые, anchor-точки, zoom, pan |
| `hooks/use-roadmap-graph-layout.ts` | React-хук: синхронизация DOM-замеров и рёбер |
| `components/roadmap-view.tsx` | Главный компонент: CSS Grid + SVG + интерактивность |
| `globals.css` (строки 1158-1277) | Стили графа: grid, gap, карточки, стрелки |

---

## 2. Модель данных

### Топик (тема)

```typescript
interface RoadmapTopic {
  id: string;
  title: string;
  description: string;
  position: number;               // Определяет направление при раскладке
  status: RoadmapTopicStatus;     // not_started | in_progress | paused | completed
  progressPercent: number;
  prerequisiteTopicIds: string[];  // Рёбра DAG: «я зависят от этих тем»
  // ...
}
```

### Поле `position` -- ось направленности

`position` -- целое число. Оно определяет **направление** дочернего узла относительно родителя:

```typescript
function classifyDirection(parent, child): "left" | "right" | "below" {
  if (child.position < parent.position) return "left";
  if (child.position > parent.position) return "right";
  return "below";  // position совпадают
}
```

Пример: родитель с `position=5`:
- Дочерний с `position=3` -- **слева**
- Дочерний с `position=7` -- **справа**
- Дочерний с `position=5` -- **снизу**

### DAG-структура

Темы связаны через `prerequisiteTopicIds`. Это DAG: циклы запрещены на уровне бэкенда.
У темы может быть несколько родителей (prerequisites), но при раскладке каждая тема
принадлежит ровно одному поддереву (первый родитель, который «заберёт» тему, владеет ею).

### Ответ API

```typescript
interface RoadmapResponse {
  stages?: RoadmapStage[];   // Стадии со вложенными темами
  topics?: RoadmapTopic[];   // Или плоский список (stage-free режим)
}
```

Функция `flattenRoadmapTopics` унифицирует оба формата в плоский массив.

---

## 3. Алгоритм раскладки (Layout)

Центральная функция: `buildTopicGridPlacementById(stages) → Map<id, {row, column}>`.

Алгоритм -- **двухпроходный**: сначала измерить, потом разместить.

### 3.1 Предобработка: построение леса

Из плоского массива тем строится **лес** (forest) деревьев раскладки:

```typescript
interface LayoutNode {
  topicId: string;
  leftChildren: LayoutNode[];   // position < parent.position
  rightChildren: LayoutNode[];  // position > parent.position
  belowChildren: LayoutNode[];  // position === parent.position
  extent: SubtreeExtent;        // Заполняется на Pass 1
}
```

**Алгоритм buildLayoutForest:**

1. Отсортировать все темы по `position` (при равных -- по `id` лексикографически)
2. Построить `childIdsByParentId` из `prerequisiteTopicIds`
3. Множество `claimed` гарантирует, что каждая тема попадает в ровно одно поддерево
4. Сначала обрабатываются корни (темы без prerequisites)
5. Для каждого корня рекурсивно строится дерево: дочерние распределяются по направлениям
6. Темы, не попавшие ни в одно дерево, становятся дополнительными корнями или сиротами

### 3.2 Pass 1 (bottom-up): вычисление размеров поддеревьев

Функция `computeSubtreeExtent` обходит дерево **пост-ордером** (сначала листья, потом родители).

```typescript
interface SubtreeExtent {
  leftCols: number;   // Столбцов, занятых СЛЕВА от узла
  rightCols: number;  // Столбцов, занятых СПРАВА от узла
  upRows: number;     // Строк, занятых ВЫШЕ узла
  downRows: number;   // Строк, занятых НИЖЕ узла
}
```

Полный размер bounding box поддерева:
- **Ширина** = `leftCols + 1 + rightCols`
- **Высота** = `upRows + 1 + downRows`

#### Вычисление для левых/правых дочерних (вертикальный столбец)

Left- и right-дочерние формируют **вертикальный столбец**. Все дочерние стоят в одном столбце,
друг под другом.

```
Суммарная высота столбца = sum(child.upRows + 1 + child.downRows)  для каждого дочернего
```

Родитель **центрируется** по вертикали относительно своего столбца дочерних:

```typescript
const maxSideRowSpan = Math.max(leftRowSpan, rightRowSpan, 1);
const centerOffset = Math.floor((maxSideRowSpan - 1) / 2);
// centerOffset -- сколько строк ВЫШЕ родителя нужно для центрирования
```

Пример: 3 правых дочерних -> `rightRowSpan = 3` -> `centerOffset = 1`:
```
       child1  (row = parentRow - 1)
  P    child2  (row = parentRow)      ← parent по центру
       child3  (row = parentRow + 1)
```

Пример: 2 правых дочерних -> `rightRowSpan = 2` -> `centerOffset = 0`:
```
  P    child1  (row = parentRow)
       child2  (row = parentRow + 1)
```

#### Зазор до столбца дочерних

Между родителем и столбцом left/right-дочерних -- минимум 1 колонка. Но если дочерний
сам имеет поддерево, растущее обратно в сторону родителя, зазор увеличивается:

```typescript
// Для правых дочерних:
const childLeftOverlap = Math.max(...rightChildren.map(c => c.extent.leftCols));
const gap = 1 + childLeftOverlap;  // Минимум 1, больше если дочерний «торчит» влево
```

#### Вычисление для below-дочерних (горизонтальная строка)

Below-дочерние формируют **горизонтальную строку**. Каждый дочерний занимает
`leftCols + 1 + rightCols` колонок.

```
belowColSpan = sum(child.leftCols + 1 + child.rightCols)  для каждого дочернего
```

#### Координация below-строки с side-столбцами

Если у родителя есть и right-дочерние (вертикальный столбец), и below-дочерние
(горизонтальная строка), they could collide в нижнем-правом углу. Решение:
below-строка начинается **ниже** самого нижнего side-дочернего:

```typescript
const sideDownSpan = maxSideRowSpan - 1 - centerOffset;
const belowRowOffset = Math.max(1, sideDownSpan + 1) + belowUpExtension;
// belowUpExtension -- если below-дочерний сам имеет поддерево, растущее вверх
```

Визуально:
```
  P    right1   (row = parentRow)
       right2   (row = parentRow + 1)
  below1  below2   (row = parentRow + 2)  ← после ВСЕХ side-дочерних
```

#### Итоговый extent

```typescript
upRows    = centerOffset;
downRows  = max(sideDownSpan, belowRowOffset + belowDownExtension);
leftCols  = max(leftColsFromLeft, 0);
rightCols = max(rightColsFromRight, belowColSpan - 1);
```

`rightCols` берёт максимум из правого столбца и below-строки, потому что below-строка
начинается с колонки родителя и растёт вправо -- она может быть шире right-столбца.

### 3.3 Pass 2 (top-down): размещение с центрированием

Функция `placeSubtree` обходит дерево **пре-ордером** (сначала родитель, потом дочерние).

**Вход:** координаты узла `(nodeRow, nodeCol)`, уже определённые родителем.

**Алгоритм для каждого узла:**

1. Записать `{row: nodeRow, column: nodeCol}` в `placementById`

2. **Left-дочерние** -- вертикальный столбец слева:
   ```
   childCol  = nodeCol - 1 - maxChildRightOverlap
   startRow  = nodeRow - floor((leftRowSpan - 1) / 2)
   // Каждый дочерний размещается на cursor + child.upRows
   // cursor сдвигается на child.upRows + 1 + child.downRows
   ```

3. **Right-дочерние** -- вертикальный столбец справа (зеркально):
   ```
   childCol  = nodeCol + 1 + maxChildLeftOverlap
   startRow  = nodeRow - floor((rightRowSpan - 1) / 2)
   ```

4. **Below-дочерние** -- горизонтальная строка:
   ```
   belowRow  = nodeRow + max(1, sideDown + 1) + belowUpExtension
   cursor    = nodeCol  // начинаем с колонки родителя
   // Каждый дочерний на (belowRow, cursor + child.leftCols)
   // cursor += child.leftCols + 1 + child.rightCols
   ```

### 3.4 Размещение корневых поддеревьев

Корни размещаются последовательно слева направо с **зазором** (`SUBTREE_GAP = 1` пустая колонка):

```typescript
let nextCol = 1;
for (const root of roots) {
  const rootCol = nextCol + root.extent.leftCols;
  const rootRow = 1 + root.extent.upRows;
  placeSubtree(root, rootRow, rootCol, placementById);
  nextCol = rootCol + root.extent.rightCols + 1 + SUBTREE_GAP;
}
```

Это гарантирует, что поддеревья не пересекаются. Пример:

```
     X              Y         (col=4 пустой -- SUBTREE_GAP)
  x1  x2  x3     y1  y2
```

### 3.5 Нормализация

После размещения всех узлов, координаты нормализуются: минимальный row и column приводятся к 1.
Это необходимо, потому что центрирование может породить отрицательные строки.

### 3.6 Наглядные примеры

#### Простой: 1 родитель + 1 дочерний «снизу»

```
Данные: Parent(pos=5) → Child(pos=5)
Направление: below (позиции равны)

Раскладка:
  Parent  (row=1, col=1)
  Child   (row=2, col=1)
```

#### Три направления

```
Данные: Parent(pos=5) → Left(pos=3), Right(pos=7), Below(pos=5)

Раскладка:
  Left    Parent    Right    (row=1)
          Below              (row=2)
```

#### Центрирование: 3 правых дочерних

```
Данные: Parent(pos=5) → R1(pos=7), R2(pos=7), R3(pos=7)

Раскладка:
            R1   (row=1)
  Parent    R2   (row=2)  ← parent по центру
            R3   (row=3)
```

#### Смешанный: 2 правых + 2 below

```
Данные: Parent(pos=10) → Right1(pos=11), Right2(pos=11), Below1(pos=10), Below2(pos=10)

Раскладка:
  Parent    Right1   (row=1)
            Right2   (row=2)
  Below1    Below2   (row=3)  ← ниже ВСЕХ side-дочерних
```

#### Разнесение поддеревьев

```
Данные: X(pos=1), Y(pos=2)
  X → x1(pos=1), x2(pos=1), x3(pos=1)
  Y → y1(pos=2), y2(pos=2)

Раскладка:
  X                    Y          (row=1)
  x1    x2    x3   ·  y1    y2   (row=2)
  col1  col2  col3    col5  col6
                    ^
                   col4 -- пустой зазор (SUBTREE_GAP)
```

---

## 4. Рёберные соединения (Connections)

### 4.1 Построение координат

Функция `buildRoadmapConnections` работает с **DOM-прямоугольниками** карточек,
а не с grid-позициями. Это позволяет рисовать стрелки точно по пикселям.

**Алгоритм для каждого ребра (parent → child):**

1. Получить `fromRect` (прямоугольник родителя) и `toRect` (прямоугольник дочернего)
2. Вычислить центры обоих прямоугольников
3. Определить **стороны привязки** (anchor sides):
   - Если горизонтальное расстояние > вертикального: `right → left` или `left → right`
   - Иначе: `bottom → top` или `top → bottom`
4. Вычислить **точки привязки** (anchor points) на границах прямоугольников
5. Сохранить `{fromId, toId, x1, y1, x2, y2}`

```typescript
function getConnectionAnchorSides(sourceCenter, targetCenter) {
  const deltaX = targetCenter.x - sourceCenter.x;
  const deltaY = targetCenter.y - sourceCenter.y;

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    return deltaX >= 0
      ? { sourceSide: "right", targetSide: "left" }
      : { sourceSide: "left", targetSide: "right" };
  }

  return deltaY >= 0
    ? { sourceSide: "bottom", targetSide: "top" }
    : { sourceSide: "top", targetSide: "bottom" };
}
```

### 4.2 Точки привязки на прямоугольнике

Для каждой стороны карточки, anchor point -- центр этой стороны:

```
         (centerX, top)
              ┌───────────┐
              │           │
(left, midY)  │   CARD    │  (right, midY)
              │           │
              └───────────┘
         (centerX, bottom)
```

Координаты нормализованы относительно контейнера графа (containerRect.left, containerRect.top).

### 4.3 Кубические кривые Безье

Функция `buildConnectionPath(x1, y1, x2, y2)` строит SVG-путь.

**Стратегия выбора контрольных точек:**

- Если `|deltaX| > |deltaY|` (горизонтальный маршрут) -- контрольные точки смещаются по X:
  ```
  M x1 y1 C controlX y1, controlX y2, x2 y2
  ```
  где `controlX = x1 + sign(deltaX) * max(|deltaX| * 0.5, 18)`

- Если `|deltaY| >= |deltaX|` (вертикальный маршрут) -- контрольные точки смещаются по Y:
  ```
  M x1 y1 C x1 controlY, x2 controlY, x2 y2
  ```
  где `controlY = y1 + sign(deltaY) * max(|deltaY| * 0.5, 18)`

Минимальное расстояние контрольной точки: `ROADMAP_MIN_BEZIER_CONTROL = 18px`.
Это предотвращает «схлопывание» кривой в прямую линию для близко стоящих карточек.

**Визуализация:**

Горизонтальный маршрут (parent слева, child справа):
```
  parent ──────╮
               │  ← контрольные точки по X
               ╰────── child
```

Вертикальный маршрут (parent сверху, child снизу):
```
  parent
     │
     ╰──╮  ← контрольные точки по Y
        │
      child
```

### 4.4 Маркер стрелки

SVG `<marker>` с треугольником `<polygon points="0 0, 16 6, 0 12">`:
- Размер: 16x12 userSpaceOnUse
- Привязка наконечника: `refX=15, refY=6` (кончик стрелки на 15px по X)
- Ориентация: `orient="auto"` (автоповорот по направлению пути)
- Цвет: `#c2d2ef` (мягкий голубой)

---

## 5. Рендеринг: CSS Grid + SVG

### 5.1 Слоёная структура DOM

```
.roadmap-graph               ← Контейнер с overflow:hidden, cursor:grab
  .roadmap-graph-canvas       ← Трансформируемый слой (translate + scale)
    svg.roadmap-connections    ← SVG-слой для стрелок (z-index:0)
      <marker>                 ← Определение наконечника стрелки
      <path> × N               ← Кривые Безье для каждого ребра
    .roadmap-connection-controls ← Кнопки удаления рёбер (z-index:2)
      <button> × N
    .roadmap-graph-scene       ← Контейнер сцены (z-index:1)
      ul.roadmap-graph-nodes   ← CSS Grid с карточками
        li × N                  ← Элемент сетки (grid-row, grid-column)
          article.roadmap-topic-card ← Визуальная карточка
```

### 5.2 CSS Grid

```css
.roadmap-graph-nodes {
  display: grid;
  grid-auto-rows: minmax(0, auto);  /* Строки подстраиваются под контент */
  column-gap: 80px;                  /* 80px между столбцами */
  row-gap: 80px;                     /* 80px между строками */
  justify-content: start;
  align-items: start;
}

.roadmap-graph-nodes > li {
  width: 280px;                      /* Фиксированная ширина карточки */
}
```

Количество столбцов определяется динамически:

```tsx
const maxGridColumns = Math.max(
  ...Array.from(topicGridPlacementById.values()).map(p => p.column),
  1
);

<ul style={{
  gridTemplateColumns: `repeat(${maxGridColumns}, minmax(280px, 280px))`
}}>
```

Каждый элемент `<li>` позиционируется через inline-стили:

```tsx
<li style={{
  gridRow: placement?.row ?? 1,
  gridColumn: placement?.column ?? Math.max(topic.position, 1)
}}>
```

### 5.3 Почему CSS Grid, а не абсолютное позиционирование

| CSS Grid | Абсолютное позиционирование |
|---|---|
| Автоматическое управление размерами строк/столбцов | Нужно вручную считать высоту каждой карточки |
| `gap` обеспечивает равномерные отступы | Отступы нужно вычислять вручную |
| Масштабирование через `scale()` влияет на весь grid | Нужно пересчитывать все координаты при zoom |
| Новые карточки автоматически расширяют grid | Нужно пересчитывать размер контейнера |

### 5.4 SVG-наложение

SVG-элемент `svg.roadmap-connections` накладывается на grid через `position: absolute; inset: 0`.
Его `viewBox` совпадает с размерами `graphSize`:

```tsx
<svg viewBox={`0 0 ${graphSize.width} ${graphSize.height}`}
     preserveAspectRatio="none">
```

`pointer-events: none` позволяет кликать сквозь SVG на карточки.
`overflow: visible` разрешает стрелкам выходить за границы viewBox.

### 5.5 Стили карточки

```css
.roadmap-topic-card {
  border: 2px solid var(--border-soft);
  border-radius: 18px;
  background: var(--surface);
  padding: 16px;
  display: grid;
  gap: 12px;
  min-height: 208px;
  cursor: pointer;
  transition: border-color 120ms, box-shadow 120ms, transform 120ms;
}

.roadmap-topic-card:hover {
  border-color: #a8c4fb;
  box-shadow: 0 14px 28px rgba(37, 99, 235, 0.1);
  transform: translateY(-1px);
}
```

---

## 6. Zoom и Pan: навигация по сцене

### 6.1 Модель трансформации

```typescript
interface GraphSceneTransform {
  scale: number;    // 0.6 ... 1.8
  offsetX: number;  // Смещение по X в пикселях
  offsetY: number;  // Смещение по Y в пикселях
}
```

Применяется к `.roadmap-graph-canvas`:

```css
transform: translate(${offsetX}px, ${offsetY}px) scale(${scale});
transform-origin: 0 0;  /* Точка отсчёта -- верхний-левый угол */
```

### 6.2 Zoom (колёсико мыши)

```typescript
function getRoadmapWheelZoomBehavior(
  deltaY: number,        // Из WheelEvent
  viewportWidth: number, // Ширина viewport
  mobileBreakpoint: number
): { preventPageScroll: boolean; scaleDelta: number }
```

- Работает только на десктопе (`viewportWidth > mobileBreakpoint`)
- На мобильных -- обычная прокрутка
- Шаг: `ROADMAP_WHEEL_SCALE_STEP = 0.12`
- Scroll вниз (`deltaY > 0`) = уменьшение масштаба, вверх = увеличение

### 6.3 Zoom вокруг точки курсора

При изменении масштаба, точка под курсором должна остаться на месте:

```typescript
function getGraphOffsetForScale(
  anchor: GraphPoint,          // Позиция курсора в viewport
  current: GraphSceneTransform,
  nextScale: number
): GraphPoint {
  // Мировые координаты точки под курсором
  const worldX = (anchor.x - current.offsetX) / current.scale;
  const worldY = (anchor.y - current.offsetY) / current.scale;

  // Новый offset, чтобы worldX/worldY остались под cursor
  return {
    x: anchor.x - worldX * nextScale,
    y: anchor.y - worldY * nextScale
  };
}
```

**Математика:** если точка мира `(wx, wy)` отображается на экране как `(sx, sy)`:
```
sx = wx * scale + offsetX
```
При новом масштабе `newScale` хотим, чтобы `sx` не изменилось:
```
sx = wx * newScale + newOffsetX
newOffsetX = sx - wx * newScale
```

### 6.4 Pan (перетаскивание)

Drag detection через порог `isDragGesture(start, current, threshold=8)` --
расстояние Евклида >= 8px. Это отличает клик от перетаскивания.

При pan:
```
offsetX += (currentPointerX - previousPointerX)
offsetY += (currentPointerY - previousPointerY)
```

Курсор: `cursor: grab` в покое, `cursor: grabbing` при активном pan
(`[data-panning="true"]`).

### 6.5 Нормализация координат

Для обратного преобразования (из экранных координат в мировые):

```typescript
function normalizeGraphPoint(
  clientX: number,
  clientY: number,
  graphOffset: { left, top },
  transform?: GraphSceneTransform
): GraphPoint {
  const viewportX = clientX - graphOffset.left;
  const viewportY = clientY - graphOffset.top;

  if (!transform) return { x: viewportX, y: viewportY };

  return {
    x: (viewportX - transform.offsetX) / transform.scale,
    y: (viewportY - transform.offsetY) / transform.scale
  };
}
```

### 6.6 Мобильное поведение

На мобильных устройствах (`@media (max-width: breakpoint)`):
- Zoom/pan отключены
- `transform: none !important`
- `overflow: auto` (нативная прокрутка)
- `cursor: default`
- Кнопки удаления рёбер скрыты

---

## 7. Реактивный цикл обновления

### 7.1 Хук useRoadmapGraphLayout

```typescript
function useRoadmapGraphLayout({
  status, data, graphRef, topicRefs, transform
}): { connections: RoadmapConnection[], graphSize: GraphSize }
```

**Цикл обновления:**

1. Данные изменились (`status`, `data`) → запланировать `requestAnimationFrame`
2. В `rAF` callback:
   a. Получить `containerRect = graphRef.getBoundingClientRect()`
   b. Для каждой карточки `topicRefs.get(id).getBoundingClientRect()`
   c. Нормализовать координаты с учётом текущего transform
   d. Вызвать `buildRoadmapConnections(data, containerRect, normalizedRects)`
   e. Вычислить `readGraphSize(graphElement)` -- max(clientWidth, scrollWidth)
3. Обновить state: `setConnections(...)`, `setGraphSize(...)`

**Debounce через requestAnimationFrame:**
```typescript
const scheduleRecalculate = () => {
  cancelAnimationFrame(frame);        // Отменить предыдущий
  frame = requestAnimationFrame(recalculate);  // Запланировать новый
};
```

Это обеспечивает максимум один пересчёт за кадр, даже если изменения приходят чаще.

### 7.2 Порядок исполнения при изменении данных

```
1. API-ответ → обновление state → re-render компонента
2. useMemo(buildTopicGridPlacementById) → новые grid-позиции
3. Компонент рендерит <li> с новыми gridRow/gridColumn
4. Браузер layout → карточки перемещаются по CSS Grid
5. useEffect → requestAnimationFrame → getBoundingClientRect
6. buildRoadmapConnections → новые координаты рёбер
7. SVG <path> обновляются
```

### 7.3 Почему рёбра зависят от DOM, а не от grid-позиций

Grid-позиции (`row=2, column=3`) -- это логические координаты. Реальные пиксельные координаты
зависят от:
- Размера контента карточки (разная высота строк)
- Zoom-уровня (scale)
- Pan-смещения (offsetX, offsetY)
- Ширины viewport

Поэтому `buildRoadmapConnections` получает **актуальные bounding rects** из DOM,
а не вычисляет координаты из grid-позиций.

---

## 8. Тестирование

### 8.1 Юнит-тесты раскладки

Файл: `roadmap-layout.test.ts`. Используется Node's native test runner + `assert/strict`.

**Тест-кейсы раскладки:**

| Кейс | Что проверяется |
|---|---|
| Directional semantics | Left слева, right справа, below снизу от parent |
| Avoids collisions | Все {row, column} уникальны при смешанных направлениях |
| Left children stacking | 2 left-дочерних в одном столбце, разные строки |
| Right children stacking | 2 right-дочерних в одном столбце, разные строки |
| Below children spreading | 2 below-дочерних в одной строке, разные столбцы |
| Centers 3 right children | Parent.row === средний дочерний.row |
| Centers 3 left children | Parent.row === средний дочерний.row |
| Separates subtrees | Зазор между корневыми поддеревьями > 1 колонки |
| Duplicate positions | Темы с одинаковым position в отдельных столбцах |
| Child-topic layout | Parent и below-child в одном столбце, разных строках |

**Тест-кейсы соединений:**

| Кейс | Что проверяется |
|---|---|
| Edge coordinates | Координаты bezier для prerequisite-связи |
| Missing rects | Пропуск рёбер, если карточки нет в DOM |
| Stage-free payload | Работа с плоским форматом (без stages) |
| Same-row anchors | Горизонтальные anchor-стороны для тем в одной строке |
| Left-to-right anchors | Правильный выбор сторон при обратном направлении |

### 8.2 Юнит-тесты графовых утилит

Файл: `roadmap-graph.test.ts`.

| Кейс | Что проверяется |
|---|---|
| Bezier path (top-down) | SVG-путь для вертикального маршрута |
| Bezier path (side-to-side) | SVG-путь для горизонтального маршрута |
| Anchor sides (horizontal) | Выбор left/right для горизонтально разнесённых тем |
| Anchor sides (vertical) | Выбор top/bottom для вертикально разнесённых тем |
| normalizeGraphPoint | Преобразование координат с/без transform |
| clampGraphScale | Ограничение масштаба в допустимом диапазоне |
| getGraphOffsetForScale | Стабильность anchor-точки при zoom |
| isDragGesture | Порог жеста перетаскивания |
| Wheel zoom behavior | Desktop/mobile различие, шаг масштабирования |

### 8.3 E2E-тесты (Playwright)

Файл: `e2e/roadmap-graph.spec.ts`. Serial mode, 1 worker, real Docker backend.

| Кейс | Что проверяется |
|---|---|
| Root + 3 directions | Создание root + left/right/below, 3 стрелки, нет перекрытий |
| Below horizontal layout | 2 below-дочерних: одинаковый top (±10px), разный left |
| Right vertical layout | 2 right-дочерних: одинаковый left (±10px), разный top |
| Visual regression | Screenshot viewport с 4 темами |

Проверка перекрытий:
```typescript
const noOverlap = await page.evaluate(() => {
  const rects = [...document.querySelectorAll(".roadmap-topic-card")]
    .map(el => el.getBoundingClientRect());
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++) {
      const overlapW = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const overlapH = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (overlapW > 4 && overlapH > 4) return { ok: false, i, j };
    }
  return { ok: true };
});
```

---

## 9. Ключевые проектные решения

### 9.1 Двухпроходный алгоритм vs. жадный однопроходный

**Предыдущая версия** использовала жадный однопроходный подход:
- Родитель размещается первым
- Дочерние пытаются встать рядом, при коллизии сдвигаются
- Проблемы: родитель не по центру столбца, поддеревья наползают друг на друга

**Текущая версия** -- двухпроходный:
- Pass 1: рекурсивно посчитать, сколько места нужно каждому поддереву
- Pass 2: размещать с заранее известными размерами, центрируя родителей
- Преимущества: предсказуемость, отсутствие коллизий by construction

### 9.2 CSS Grid vs. Canvas/WebGL

Выбран CSS Grid потому что:
- Карточки -- это полноценный HTML (текст, кнопки, бейджи, hover-эффекты)
- Accessibility из коробки (role, tabIndex, aria-label)
- Анимации через CSS transitions
- Responsive через media queries
- SVG-overlay для стрелок -- проще, чем Canvas API

### 9.3 Рёбра из DOM-замеров, а не из логических координат

Рёбра строятся по `getBoundingClientRect()`, а не по `{row, column}`:
- Grid-строки имеют разную высоту (разный контент карточек)
- Zoom изменяет пиксельные размеры
- Не нужно дублировать логику CSS Grid в JavaScript

### 9.4 requestAnimationFrame как debounce

Вместо `setTimeout` или `ResizeObserver` для debounce используется `requestAnimationFrame`:
- Гарантирует один пересчёт за кадр
- Синхронизирован с paint-циклом браузера
- Нет лишних промежуточных состояний

### 9.5 SUBTREE_GAP = 1 пустая колонка

Зазор между корневыми поддеревьями -- одна пустая колонка CSS Grid.
При `column-gap: 80px` и ширине колонки `280px`, это даёт `280 + 80 = 360px` визуального разделения.
Между дочерними одного родителя зазора нет -- они принадлежат одному поддереву.

### 9.6 Единственный владелец при множественных prerequisites

Если тема имеет несколько `prerequisiteTopicIds`, она «принадлежит» первому родителю
(в порядке сортировки), который добавит её в своё дерево. Множество `claimed` предотвращает
двойное размещение. Остальные parents всё равно получат стрелку к этой теме
(через `buildRoadmapConnections`), но не влияют на grid-позицию.
