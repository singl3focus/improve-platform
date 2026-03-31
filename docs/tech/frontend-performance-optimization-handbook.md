# Методическое пособие: как мы устраняли фризы во frontend и почему это сработало

## Для кого этот документ

Этот текст написан для бэкенд-разработчика, который не хочет гадать, что именно происходит во фронтенде при лагах, скролле, zoom/pan и "подвисаниях".

Задача документа:
- объяснить базовую теорию без предположения, что читатель глубоко знает браузерный рендеринг;
- показать, какие симптомы были именно в этом проекте;
- зафиксировать, какие практические изменения были сделаны в кодовой базе;
- объяснить, как эти изменения влияют на производительность;
- дать повторяемый алгоритм диагностики и верификации.

---

## 1. Что вообще означает "фризит фронтенд"

Когда пользователь говорит "страница фризит", это обычно не один дефект, а один из нескольких классов проблем:

1. JavaScript слишком долго занимает main thread.
2. Браузер слишком часто пересчитывает layout.
3. Paint/raster/compositing стоят слишком дорого.
4. UI перерисовывается чаще, чем нужно.
5. Данные грузятся водопадом, и экран постоянно дообновляется кусками.
6. Комбинация всех пунктов выше.

Во frontend производительность почти всегда надо разбирать на уровне причин, а не только ощущений.

---

## 2. Базовая теория: как браузер рисует интерфейс

### 2.1 Main thread

Main thread браузера делает много работы:
- исполняет JavaScript;
- обрабатывает события `scroll`, `pointermove`, `wheel`, `click`;
- запускает React render/reconcile;
- пересчитывает стили;
- пересчитывает layout.

Если main thread занят долго, пользователь чувствует лаг между действием и визуальным откликом.

### 2.2 Layout

Layout, или reflow, это этап, на котором браузер решает:
- где находится каждый DOM-элемент;
- какой у него размер;
- как он влияет на соседние элементы.

Если изменение одного элемента заставляет пересчитать много соседних элементов, layout становится дорогим.

### 2.3 Paint и Raster

После layout браузер рисует пиксели. Это paint/raster:
- фон;
- границы;
- тени;
- blur;
- градиенты;
- текст;
- SVG.

Даже если JavaScript быстрый, интерфейс может тормозить из-за дорогой покраски.

### 2.4 Compositing

Браузер раскладывает интерфейс по слоям и комбинирует их на экране. Некоторые CSS-эффекты делают это дороже:
- `backdrop-filter`;
- большие полупрозрачные blur-поверхности;
- тяжёлые `box-shadow`;
- большие области с постоянным `transform`.

### 2.5 React поверх браузера

React не рисует пиксели сам. Он:
- получает state/props;
- рассчитывает новое дерево компонентов;
- обновляет DOM.

Значит, React-проблемы обычно бьют по:
- числу render/re-render;
- объёму DOM-изменений;
- частоте обновления state.

---

## 3. Какие метрики полезно смотреть

### 3.1 LCP

`Largest Contentful Paint` показывает, насколько быстро появился основной контент.

Он полезен для загрузки страницы, но почти не отвечает на вопрос "почему тормозит pan/zoom".

### 3.2 CLS

`Cumulative Layout Shift` показывает визуальные скачки интерфейса.

Если CLS нулевой, это хорошо, но это не значит, что нет фризов.

### 3.3 INP

`Interaction to Next Paint` показывает задержку между действием пользователя и следующим визуальным откликом.

Для интерактивных экранов, вроде `roadmap`, это одна из важнейших метрик.

### 3.4 Long Tasks

Long task обычно считают как задачу main thread дольше `50 ms`.

Если long tasks есть во время scroll/pan/zoom, значит UI в этот момент физически не успевает отвечать плавно.

### 3.5 Presentation Delay

Иногда обработка события короткая, но следующий paint всё равно опаздывает. Это часто значит:
- дорогой paint;
- дорогой raster;
- дорогой compositing;
- слишком тяжёлый DOM на обновляемом участке.

Именно такая картина была особенно важна для `roadmap`.

---

## 4. Какие симптомы были в этом проекте

### 4.1 Dashboard

Симптомы:
- при scroll чувствовалась неплавность;
- при некоторых оптимизациях появились белые прямоугольники вместо секций;
- данные грузились несколькими независимыми запросами и экран дообновлялся частями.

### 4.2 Roadmap

Симптомы:
- pan/zoom лагали;
- раньше доходило до client-side exception;
- при неудачной оптимизации ломался размер сцены, и граф становился неудобно огромным;
- по trace был высокий `INP`, а особенно большой `Presentation delay`.

### 4.3 Topics

Симптомы:
- scroll был чуть лучше после первых правок, но не плавный;
- часть модалок вела себя некорректно по viewport;
- ощущение лага было похоже скорее на paint/raster, чем на тяжёлый React state.

### 4.4 Дополнительные дефекты

Параллельно всплыли смежные проблемы:
- broken Russian copy из-за mojibake;
- проблемы fixed/modal overlay внутри тяжёлых контейнеров;
- лишние blur/shadow-эффекты на крупных поверхностях.

---

## 5. Корневые причины по слоям

### 5.1 Слой данных: водопады и N+1

Если один экран делает много независимых client-fetch запросов, происходят сразу несколько плохих вещей:
- больше сетевых round-trip;
- больше независимых обновлений state;
- больше фаз перерендера;
- сложнее контролировать loading/fallback;
- выше шанс race conditions.

В проекте это было особенно заметно в `dashboard`, а в BFF ещё и в fan-out логике по roadmap/topic metrics.

### 5.2 React-слой: слишком частые обновления state

Если pan/zoom пишется в React state на каждый кадр:
- React должен заново проходить компонентное дерево;
- DOM обновляется слишком часто;
- интерактивность начинает упираться не в одну transform-операцию, а в полный React-цикл.

Именно это было одним из главных источников jank в `roadmap`.

### 5.3 Layout-слой: измерения и геометрия

Если во время движения графа слишком часто:
- читаются DOM-метрики;
- обновляются refs;
- пересчитываются связи;
- меняется контейнерный размер,

то можно получить каскад reflow/layout.

### 5.4 Paint/compositing-слой

Большие glassmorphism-панели красивы, но тяжелы:
- `backdrop-filter` на крупных поверхностях часто дорог;
- большие мягкие тени дорогие при скролле;
- hover/transform на множестве карточек увеличивают цену кадра;
- некоторые формы `content-visibility` дают pop-in или "белые прямоугольники", если применены к неудачным контейнерам.

### 5.5 Overlay-слой

Модалки внутри контейнеров с transform/filter/stacking context часто ведут себя хуже, чем ожидается:
- ломается fixed-position логика;
- кнопки уезжают за viewport;
- clipping и scroll-контексты становятся неожиданными.

Это стало важно для `topics`.

---

## 6. Что было изменено в проекте

Ниже перечислены не абстрактные советы, а реальные изменения, сделанные в этом репозитории.

### 6.1 Dashboard: один агрегированный BFF вместо россыпи запросов

Был добавлен единый endpoint [route.ts](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/app/api/dashboard/overview/route.ts), который возвращает агрегированный payload dashboard.

Что это дало:
- один primary client request вместо набора независимых;
- меньше точек обновления UI;
- меньше промежуточных loading-state;
- проще инвалидация;
- меньше шанс "дерганого" появления секций.

Контракт был централизован в [types.ts](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/src/features/dashboard/types.ts), а сам экран переведён на единый view-model в [use-dashboard-view-model.ts](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/src/features/dashboard/hooks/use-dashboard-view-model.ts).

### 6.2 React Query как единая стратегия экрана

Там, где были ad-hoc загрузки с `useEffect + local loading state`, логика была сведена к более предсказуемой query-модели:
- `dashboard`;
- `weekly-review`;
- `history`;
- `topics`.

Ключевая идея: на экран должен приходиться один primary query, а не пачка разрозненных ручных fetch-циклов.

### 6.3 Устранение N+1 и последовательных fan-out в BFF

Для BFF был добавлен helper [map-with-concurrency.ts](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/src/shared/lib/map-with-concurrency.ts).

Он решает практическую задачу:
- не делать обработку topic/material metrics строго последовательно;
- не запускать бесконтрольный параллелизм;
- держать лимит конкурентности;
- сохранять порядок результатов;
- корректно обрабатывать частичные ошибки.

Этот helper был использован в:
- [dashboard/_shared.ts](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/app/api/dashboard/_shared.ts)
- [roadmaps/[roadmapId]/route.ts](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/app/api/roadmaps/[roadmapId]/route.ts)

### 6.4 Abort/timeout propagation в backend client

Был доработан [backend-client.ts](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/src/shared/api/backend-client.ts), чтобы BFF и клиентские запросы аккуратнее работали с timeout/abort.

Это важно не только для UX, но и для нагрузки:
- медленный подзапрос не должен держать весь экран hostage;
- отменённый переход не должен продолжать бесполезно грузить данные.

### 6.5 Roadmap: pan/zoom вынесен из React state в прямую DOM-transform

Ключевой architectural fix был сделан в [roadmap-view.tsx](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/src/features/roadmap/components/roadmap-view.tsx).

Основная идея:
- React state хранит только committed snapshot;
- быстрые промежуточные transform-обновления идут через `ref`;
- запись transform батчится в `requestAnimationFrame`;
- на каждый pointer move не запускается полный React render.

Это принципиально важное отличие:

Плохо:
- пользователь двигает мышь;
- state меняется десятки раз в секунду;
- React гоняет дерево;
- UI начинает отставать.

Хорошо:
- пользователь двигает мышь;
- мы напрямую обновляем `style.transform` канваса;
- React остаётся в стороне от кадрового цикла.

### 6.6 Roadmap: стабилизация ref-коллбеков и измерений

Отдельно была устранена проблема, которая вызывала client-side exception и цикл обновлений:
- ref-коллбеки нод графа были стабилизированы;
- измерения перестали дёргать бесконечные layout-triggering state updates.

Это важно, потому что нестабильный ref callback в React может сам по себе стать генератором перерисовок.

### 6.7 Roadmap: layout пересчитывается по делу

Вместо наивного постоянного пересчёта геометрии логика была вынесена в [use-roadmap-graph-layout.ts](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/src/features/roadmap/hooks/use-roadmap-graph-layout.ts).

Основные принципы:
- использовать `ResizeObserver`, когда реально меняется размер;
- группировать DOM reads в `requestAnimationFrame`;
- пересчитывать connections/layout не на каждый жест, а только при значимых изменениях.

### 6.8 Roadmap: корректный размер сцены

Одна из регрессий показывала "огромное окно" и неудобную навигацию по графу.

Причина была в неправильной привязке размеров графа к контейнерным `scrollWidth/scrollHeight`.

Исправление:
- размер сцены стал вычисляться относительно внутренней сцены графа, а не внешнего scrolling-контейнера.

Это важный урок: оптимизация геометрии может легко сломать UX, если перепутать систему координат.

### 6.8.1 Roadmap: устранение деградации через несколько секунд после открытия графа

Отдельная проблема проявилась не сразу, а через несколько секунд нахождения в графе:
- пользователь открывал `roadmap`;
- первые секунды всё было относительно нормально;
- затем pan/zoom становились заметно хуже;
- ощущение было такое, будто граф "накапливает" лаг.

Это важный класс дефекта: не мгновенный slow interaction, а **деградация со временем**.

Причина оказалась составной:
- `useRoadmapGraphLayout` держал `ResizeObserver` не только на контейнере сцены, но и на каждой карточке;
- при каждом observer-срабатывании происходил пересчёт и `setConnections`/`setGraphSize`, даже если результат фактически не менялся;
- на канвасе постоянно висел `will-change: transform`, то есть браузер держал дорогой compositing-режим не только во время реального pan/zoom, а всё время;
- panning-режим был привязан к `body`, из-за чего браузер шире пересчитывал стили, чем нужно для одного графа.

Исправление было сделано в:
- [use-roadmap-graph-layout.ts](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/src/features/roadmap/hooks/use-roadmap-graph-layout.ts)
- [roadmap-view.tsx](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/src/features/roadmap/components/roadmap-view.tsx)
- [globals.css](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/app/globals.css)

Что именно изменили:
- `ResizeObserver` перестал наблюдать каждую карточку графа;
- пересчёт layout/connections теперь коалесцируется в один `requestAnimationFrame`;
- `setConnections` и `setGraphSize` вызываются только если новое значение действительно отличается от старого;
- `will-change: transform` включается только в короткий interaction-window во время реального pan/zoom;
- panning-стили ограничены самим `.roadmap-graph`, а не всем `body`.

Почему это помогает:
- исчезает накопительная бесполезная работа;
- React не получает лишние state-updates;
- браузер не держит тяжёлый композитный слой постоянно;
- уменьшается вероятность, что спустя несколько секунд граф деградирует по плавности просто из-за фонового churn.

### 6.8.2 Roadmap и Topics: защита от churn после перезаходов между экранами

После этого всплыл ещё один класс симптомов:
- "сначала нормально, потом после нескольких переходов снова хуже";
- особенно это ощущается после цепочки `roadmap -> topic -> dashboard -> roadmap`.

Здесь проблема уже не обязательно в утечке памяти. Часто причина в том, что экран:
- каждый раз aggressively refetch-ится при возврате;
- заново проходит лишние loading/reconcile/layout-пути;
- получает фоновый churn от query-библиотеки даже тогда, когда пользователь ждёт, что экран просто откроется из недавнего кэша.

Для этого были ужесточены query-настройки в:
- [roadmap-view.tsx](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/src/features/roadmap/components/roadmap-view.tsx)
- [use-topic-workspace-view-model.ts](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/src/features/topics/hooks/use-topic-workspace-view-model.ts)

Что именно изменили:
- `staleTime: 5 * 60 * 1000`
- `refetchOnWindowFocus: false`
- `refetchOnReconnect: false`
- `refetchOnMount: false`

Почему это помогает:
- недавний экран не пересобирается агрессивно без реальной необходимости;
- переходы назад ощущаются стабильнее;
- уменьшается вероятность, что после серии перезаходов пользователь почувствует "постепенное ухудшение", хотя реальной утечки нет.

Важно: это не означает "никогда не обновлять данные". Это означает, что для этих экранов приоритет выше у устойчивой интерактивности, чем у мгновенного фонового refetch при каждом возврате.

### 6.9 Topics: модалки вынесены в portal

Для `topic workspace` модалки были вынесены в `document.body` через portal в [topic-workspace-view.tsx](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/src/features/topics/components/topic-workspace-view.tsx).

Почему это помогло:
- модалка перестала жить внутри тяжёлого контейнера;
- fixed overlay снова стал реально fixed относительно viewport;
- submit-кнопка перестала уезжать;
- снизились побочные эффекты от stacking context и фильтров.

### 6.10 CSS: упрощение тяжёлых визуальных эффектов

Существенная часть работы была не про JavaScript, а про визуальные поверхности:
- ослаблены дорогие `box-shadow`;
- убран тяжёлый `backdrop-filter` с крупных панелей;
- для некоторых hover-эффектов уменьшена постоянная стоимость;
- убраны неудачные попытки оптимизировать через `content-visibility`, которые визуально давали белые прямоугольники.

Основные изменения находятся в:
- [globals.css](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/app/globals.css)
- [editorial-overrides.css](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/app/editorial-overrides.css)

### 6.11 Исправление broken copy

Хотя это не perf-оптимизация в прямом смысле, broken Russian copy тоже была частью итогового качества.

Исправления были сделаны в:
- [dashboard-view.tsx](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/src/features/dashboard/components/dashboard-view.tsx)
- [activity-heatmap.tsx](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/src/features/dashboard/components/activity-heatmap.tsx)
- [topic-workspace-view.tsx](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/src/features/topics/components/topic-workspace-view.tsx)
- [roadmap-view.tsx](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/src/features/roadmap/components/roadmap-view.tsx)

Это важно по двум причинам:
- визуальные дефекты не должны смешиваться с perf-анализом;
- broken text иногда косвенно ломает layout и e2e-ожидания.

---

## 7. Почему некоторые "оптимизации" оказались вредными

Хорошая производительность почти всегда достигается через измерения, а не через веру в магические техники.

### 7.1 `content-visibility`

Это полезный инструмент, но его легко применить не туда.

Когда его повесили на неудачные dashboard-секции, пользователь увидел белые прямоугольники во время scroll.

Причина:
- браузер действительно откладывал работу для невидимых частей;
- но визуально это выглядело как блоки, которые "догружаются".

Вывод:
- `content-visibility` не надо вешать на крупные ключевые панели без визуальной проверки;
- особенно опасно использовать его на секциях, которые должны выглядеть непрерывно при scroll.

### 7.2 Агрессивный contain

`contain` может помочь, но в сложном layout он может:
- изолировать слишком много;
- ломать ожидаемый размер;
- конфликтовать с overlay/fixed.

### 7.3 Скрытие тяжёлых слоёв во время pan

Идея может быть хорошей, но если внедрить её слишком грубо, можно испортить геометрию, hit-testing или viewport-навигацию.

Вывод тот же: perf-изменения нельзя принимать без повторной UX-проверки.

---

## 8. Как именно мы проверяли результат

### 8.1 Базовая верификация

После раундов правок прогонялись:
- `npm run build`
- `npm test`
- полный Playwright suite

Итоговый автоматический статус на последнем рабочем состоянии:
- build passed;
- unit/integration tests passed;
- Playwright suite: `20 passed`.

### 8.2 Отдельная perf-валидация trace-файлами

Для повторяемой проверки был снят отдельный набор perf traces:
- [summary.json](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/perf-traces/2026-03-31T20-10-04-912Z/summary.json)
- [dashboard-scroll.trace.json](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/perf-traces/2026-03-31T20-10-04-912Z/dashboard-scroll.trace.json)
- [roadmap-pan-zoom.trace.json](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/perf-traces/2026-03-31T20-10-04-912Z/roadmap-pan-zoom.trace.json)
- [topic-scroll.trace.json](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/perf-traces/2026-03-31T20-10-04-912Z/topic-scroll.trace.json)

Краткий смысл результатов:
- `dashboard`: остался один long task до `68 ms`, но общая ситуация стала заметно лучше;
- `roadmap`: scripted pan/zoom больше не показывал long task и выглядел значительно лучше по main-thread;
- `topics`: main-thread long tasks не ловились, а основной пик был ближе к raster cost.

Позже был снят ещё один набор traces уже после дополнительного исправления деградации `roadmap` во времени:
- [summary.json](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/perf-traces/2026-03-31T20-46-04-933Z/summary.json)
- [dashboard-scroll.trace.json](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/perf-traces/2026-03-31T20-46-04-933Z/dashboard-scroll.trace.json)
- [roadmap-pan-zoom.trace.json](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/perf-traces/2026-03-31T20-46-04-933Z/roadmap-pan-zoom.trace.json)
- [roadmap-long-session-pan-zoom.trace.json](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/perf-traces/2026-03-31T20-46-04-933Z/roadmap-long-session-pan-zoom.trace.json)
- [topic-scroll.trace.json](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/perf-traces/2026-03-31T20-46-04-933Z/topic-scroll.trace.json)

Ключевой смысл второго набора:
- обычный `roadmap-pan-zoom` больше не показывал long tasks;
- delayed scenario `roadmap-long-session-pan-zoom`, где перед pan/zoom делалась пауза `6s`, тоже не показал long tasks;
- это важно, потому что проблема была именно "через время становится хуже", а не только "плохо сразу".

Итог по второму набору:
- `dashboard-scroll`: `1` long task, максимум `74 ms`;
- `roadmap-pan-zoom`: `0` long tasks, основные пики ушли в умеренные `RasterTask ~20-24 ms`;
- `roadmap-long-session-pan-zoom`: `0` long tasks;
- `topic-scroll`: `0` long tasks.

Это хороший пример того, что perf-валидация должна включать не только мгновенный сценарий, но и сценарий с ожиданием, если дефект проявляется накопительно.

### 8.4 Пятиминутный endurance-сценарий

После этого был добавлен ещё более жёсткий тип проверки: не просто delayed trace после ожидания, а **endurance-проход дольше 5 минут** с переходами между экранами.

Артефакты:
- [summary.json](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/perf-traces/2026-03-31T21-59-43-436Z/summary.json)
- [roadmap-pan-zoom.trace.json](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/perf-traces/2026-03-31T21-59-43-436Z/roadmap-pan-zoom.trace.json)
- [roadmap-long-session-pan-zoom.trace.json](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/perf-traces/2026-03-31T21-59-43-436Z/roadmap-long-session-pan-zoom.trace.json)
- [dashboard-scroll.trace.json](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/perf-traces/2026-03-31T21-59-43-436Z/dashboard-scroll.trace.json)
- [topic-scroll.trace.json](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/perf-traces/2026-03-31T21-59-43-436Z/topic-scroll.trace.json)

Сценарий был таким:
- открыть `roadmap`;
- сделать pan/zoom;
- перейти в `topic`;
- поскроллить `topic`;
- перейти в `dashboard`;
- поскроллить `dashboard`;
- вернуться в `roadmap`;
- повторить цикл 10 раз.

Суммарная длительность:
- `311298 ms`, то есть примерно `5 минут 11 секунд`.

Что проверялось дополнительно:
- размер JS heap до и после;
- число roadmap-нод;
- число SVG connections;
- число connection controls;
- наличие long tasks после endurance-цикла.

Итог:
- `usedJSHeapSize` не вырос;
- число нод и connections не выросло;
- `roadmap-pan-zoom.longTaskCount = 0`;
- `roadmap-long-session-pan-zoom.longTaskCount = 0`.

Практический вывод:
- накопительной деградации по памяти, DOM и main-thread в автоматическом сценарии больше не видно;
- если пользователь всё ещё чувствует лаг на своей машине, то следующий кандидат уже не update-loop, а локальный raster/compositor path браузера и железа.

Это очень важное различие. Если автоматический endurance не показывает роста heap, DOM и long tasks, значит нужно перестать искать утечку "в логике экрана" и начать отдельно анализировать:
- GPU compositing;
- raster cost;
- драйвер/браузер-специфичное поведение;
- локальные расширения браузера;
- масштабирование дисплея и частоту обновления экрана.

### 8.3 Почему нужен и авто-трейс, и ручная проверка

Авто-трейс полезен, потому что:
- воспроизводим;
- сравним;
- можно хранить артефакты.

Ручная проверка нужна, потому что:
- человек замечает pop-in, белые блоки, неудобный viewport;
- scripted trace не всегда ловит реальные пользовательские сценарии;
- UX-регрессия может пройти мимо чисто числовых метрик.

---

## 9. Практический шаблон расследования frontend-производительности

Если завтра снова "что-то фризит", разбирать лучше так.

### Шаг 1. Локализовать экран и действие

Нельзя оптимизировать абстрактный "фронтенд".

Нужно зафиксировать:
- какой экран;
- какое действие;
- что именно ощущается;
- можно ли это повторить стабильно.

Примеры:
- scroll вниз на `dashboard`;
- pan/zoom на `roadmap`;
- scroll внутри `topics?topicId=...`.

### Шаг 2. Понять, это data, React или paint

Типовые вопросы:
- много ли запросов делает экран;
- дергается ли state слишком часто;
- дорогие ли layout/paint/compositing;
- есть ли тяжёлые blur/shadow/filter поверхности.

### Шаг 3. Снять trace

Искать надо не только long tasks.

Смотреть:
- `INP`;
- `Long tasks`;
- `Layout`;
- `Paint`;
- `RasterTask`;
- `Presentation delay`;
- network waterfall;
- частоту React-driven обновлений.

Если пользователь говорит "через 5-10 секунд становится хуже", нужно снимать **два** сценария:
- immediate trace: действие сразу после открытия;
- delayed trace: подождать несколько секунд, потом повторить то же действие.

Без delayed trace можно легко пропустить накопительную деградацию.

Если пользователь говорит "становится хуже после нескольких перезаходов и эксплуатации", нужно снимать уже **три** сценария:
- immediate trace;
- delayed trace;
- endurance trace на несколько минут с реальными переходами между связанными экранами.

### Шаг 4. Сформулировать узкую гипотезу

Примеры хороших гипотез:
- "экран тормозит из-за 8 независимых dashboard-запросов";
- "pan/zoom тормозит, потому что transform обновляется через React state";
- "scroll в topics упирается не в JS, а в paint-heavy surface";
- "модалка ломается из-за overlay внутри transformed container".

### Шаг 5. Сделать минимальное изменение

Не надо сразу переписывать полпроекта.

Лучше делать один контролируемый раунд:
- поменять источник данных;
- убрать один тяжёлый visual effect;
- вынести одну модалку в portal;
- стабилизировать один ref/update loop.

### Шаг 6. Обязательно проверить регрессии

После perf-фикса нужно проверять:
- сборку;
- тесты;
- e2e;
- реальный сценарий руками;
- метрики повторным trace.

Без этого очень легко "ускорить" экран ценой поломанного UX.

---

## 10. Ключевые уроки из этой работы

### Урок 1

Не всякий jank лечится React-оптимизацией. Часто проблема в paint/compositing.

### Урок 2

Сетевой fan-out и ручные `useEffect`-загрузки бьют по плавности сильнее, чем кажется.

### Урок 3

Для pan/zoom React state почти всегда слишком дорогой как кадровый механизм. Лучше direct transform + `requestAnimationFrame`.

### Урок 4

`content-visibility`, `contain`, `backdrop-filter` и большие тени надо применять только после измерений и визуальной проверки.

### Урок 5

Overlay и modal почти всегда безопаснее держать в portal, а не внутри сложного контейнера.

### Урок 6

Performance-работа без тестов и без собственного trace-подтверждения слишком легко приводит к ложным улучшениям.

### Урок 7

Если лаг усиливается со временем, почти всегда нужно искать:
- накопительные observer/update loops;
- лишние state-updates без изменения данных;
- постоянный `will-change` или другой дорогой режим compositing;
- слишком широкие глобальные CSS-селекторы во время interaction-state.

### Урок 8

Если 5-минутный endurance не показывает роста heap, DOM и long tasks, а пользователь всё ещё чувствует фризы, значит проблема уже может быть не в "утечке frontend-логики", а в paint/raster/compositor-пути конкретной машины.

Это другой класс задачи. Его нужно расследовать отдельно и не смешивать с React/query/layout-проблемами.

---

## 11. Краткая карта изменённых файлов

Если нужно быстро сориентироваться, с чего читать код, начни с этих файлов:

- [route.ts](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/app/api/dashboard/overview/route.ts)
- [dashboard/_shared.ts](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/app/api/dashboard/_shared.ts)
- [roadmaps/[roadmapId]/route.ts](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/app/api/roadmaps/[roadmapId]/route.ts)
- [map-with-concurrency.ts](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/src/shared/lib/map-with-concurrency.ts)
- [backend-client.ts](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/src/shared/api/backend-client.ts)
- [use-dashboard-view-model.ts](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/src/features/dashboard/hooks/use-dashboard-view-model.ts)
- [dashboard-view.tsx](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/src/features/dashboard/components/dashboard-view.tsx)
- [activity-heatmap.tsx](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/src/features/dashboard/components/activity-heatmap.tsx)
- [roadmap-view.tsx](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/src/features/roadmap/components/roadmap-view.tsx)
- [use-roadmap-graph-layout.ts](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/src/features/roadmap/hooks/use-roadmap-graph-layout.ts)
- [topic-workspace-view.tsx](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/src/features/topics/components/topic-workspace-view.tsx)
- [globals.css](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/app/globals.css)
- [editorial-overrides.css](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/app/editorial-overrides.css)
- [capture-perf-traces.mjs](/c:/Users/Дом/Documents/1GitProjects/improve-platform/frontend/scripts/capture-perf-traces.mjs)

---

## 12. Рекомендуемый процесс для следующих оптимизаций

Ниже процесс, который показал себя рабочим именно на этом проекте:

1. Зафиксировать конкретный экран и сценарий.
2. Снять trace и понять доминирующий тип стоимости.
3. Сформулировать одну узкую гипотезу.
4. Сделать один контролируемый раунд изменений.
5. Прогнать build, unit/integration, e2e.
6. Самостоятельно руками проверить UX.
7. Снять trace повторно.
8. Если дефект проявляется со временем, снять ещё и delayed trace.
9. Если дефект проявляется после серии перезаходов, снять endurance trace на несколько минут.
10. Только после этого считать оптимизацию валидной.

Это и есть главный практический вывод: frontend performance надо вести как инженерный цикл с измерением до и после, а не как подбор случайных "магических" CSS и React-трюков.
