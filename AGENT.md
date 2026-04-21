# AGENT.md — Language Research App

> Bu dosya Language Research App projesinin mimari kararlarını, veri modelini, servis yapısını ve implementation rehberini içerir. Kod yazan her ajan veya geliştirici bu dosyayı referans almalıdır.

---

## Proje Özeti

Kullanıcının yabancı dildeki metinleri (özellikle kitapları) manuel olarak çevirmesine ve çalışmasına yarayan local-first bir web uygulaması. Çeviri API'si yoktur, tüm çeviriler kullanıcı tarafından manuel girilir. Uygulama tamamen offline çalışır, auth sistemi yoktur.

**Stack:** SvelteKit + Svelte 5 + Vite + TypeScript  
**Persistence:** Dexie.js (IndexedDB)  
**State:** XState v5  
**Search:** FlexSearch  
**WordNet:** wordnet.json (96MB) → Web Worker ile seeding  
**Styling:** CSS custom properties, `oklch()`, `color-mix()`, CSS Grid/Layers

---

## Mimari Genel Bakış

```
┌─────────────────────────────────────────────────────┐
│                    SvelteKit App                    │
│                                                     │
│  ┌─────────────┐        ┌──────────────────────┐   │
│  │ XState      │        │ Svelte Components     │   │
│  │ Machines    │◄──────►│ (canvas, sidebar,     │   │
│  │             │        │  paragraph, word)     │   │
│  └──────┬──────┘        └──────────┬───────────┘   │
│         │                          │                │
│  ┌──────▼──────────────────────────▼───────────┐   │
│  │              Service Layer                   │   │
│  │  WordService │ MorphologyEngine │ FlexSearch  │   │
│  └──────────────────────┬──────────────────────┘   │
│                          │                          │
│  ┌───────────────────────▼──────────────────────┐  │
│  │              Dexie.js (IndexedDB)             │  │
│  │  chapters │ paragraphs │ words │ occurrences  │  │
│  │  sentences │ canvasNodes │ images │ settings  │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### XState / IndexedDB Sorumluluk Ayrımı

| Katman | Ne Tutar |
|---|---|
| **XState** | Aktif chapter ID, canvas zoom/pan, drag state, seçili entity, sidebar open/close, WordNet seeding durumu |
| **IndexedDB** | Tüm domain verisi (paragraflar, kelimeler, bağlantılar, pozisyonlar, notlar, blob'lar) |

> **Kural:** Sayfa kapandığında kaybolması gereken her şey XState'de, kalması gereken her şey IndexedDB'de tutulur. `selectedChapterId` tek istisnadır — her iki açılışta da aynı chapter açık kalsın diye `settings` tablosuna da yazılır.

---

## Klasör Yapısı

```
src/
├── lib/
│   ├── db/
│   │   ├── schema.ts              # Dexie db tanımı ve tablo tipleri
│   │   ├── migrations.ts          # Versiyon bazlı migration'lar
│   │   ├── seed.worker.ts         # WordNet Web Worker (seeding + FlexSearch)
│   │   └── index.ts               # db instance export
│   │
│   ├── services/
│   │   ├── WordService.ts         # Kelime CRUD, occurrence yönetimi
│   │   ├── MorphologyEngine.ts    # Lemmatization, stem lookup
│   │   └── FlexSearchIndex.ts     # Index build, search API
│   │
│   ├── machines/
│   │   ├── canvas.machine.ts      # zoom, pan, drag, selectedNode
│   │   ├── chapter.machine.ts     # activeChapterId, sidebarOpen, tree expand
│   │   ├── selection.machine.ts   # selectedType/Id, connectedIds (rope)
│   │   └── wordnet.machine.ts     # seeding: idle|loading|done|error, progress
│   │
│   └── utils/
│       ├── rope.ts                # SVG quadratic bezier path hesabı
│       ├── parser.ts              # Paragraf → cümle tokenizer
│       ├── highlight.ts           # Token → highlight span renderer
│       ├── vector2.ts             # 2D vector yardımcıları
│       └── date.ts                # createdAt/updatedAt helper'ları
│
├── types/
│   ├── domain.types.ts            # Chapter, Paragraph, Sentence, Word, vb.
│   ├── wordnet.types.ts           # WordNet entry yapısı
│   ├── canvas.types.ts            # CanvasNode, Connection, ViewState
│   └── machine.types.ts           # XState context/event tipleri
│
└── components/
    ├── canvas/
    │   ├── InfinityCanvas.svelte  # Pan/zoom container (div tabanlı)
    │   ├── CanvasNode.svelte      # Taşınabilir entity wrapper
    │   ├── RopeOverlay.svelte     # SVG rope katmanı
    │   └── Minimap.svelte         # Canvas minimap
    │
    ├── sidebar/
    │   ├── Sidebar.svelte         # Chapter tree sidebar
    │   ├── ChapterTree.svelte     # Recursive tree render
    │   └── ChapterItem.svelte     # Tek chapter satırı
    │
    ├── paragraph/
    │   ├── ParagraphCard.svelte   # Paragraf container + notes
    │   ├── ParagraphText.svelte   # Highlight'lı metin render
    │   └── SentenceTooltip.svelte # Cümle ayırma tooltip'i
    │
    ├── word/
    │   ├── WordCloud.svelte       # Kelime listesi (bağlı kelimeler)
    │   ├── WordCard.svelte        # Kelime + çeviri + notes
    │   └── WordPopover.svelte     # Hover popover (translation preview)
    │
    ├── image/
    │   └── ImageCard.svelte       # Blob resim + caption + notes
    │
    └── ui/
        ├── ContextMenu.svelte     # Sağ tık menüsü
        ├── NoteArea.svelte        # Yeniden kullanılabilir not input'u
        └── Popover.svelte         # Generic popover wrapper
```

> **Kural:** Hiçbir component 150 satırı geçmemeli. Logic büyürse `utils/` veya `services/` klasörüne taşı. Component sadece render ve event binding içermeli.

---

## Dexie Schema

```typescript
// src/lib/db/schema.ts

import Dexie, { type Table } from 'dexie'
import type {
  Chapter, Paragraph, Sentence, Word,
  Occurrence, CanvasNode, Image,
  WordnetEntry, Setting
} from '../types/domain.types'

class AppDatabase extends Dexie {
  chapters!:     Table<Chapter>
  paragraphs!:   Table<Paragraph>
  sentences!:    Table<Sentence>
  words!:        Table<Word>
  occurrences!:  Table<Occurrence>
  canvasNodes!:  Table<CanvasNode>
  images!:       Table<Image>
  wordnetCache!: Table<WordnetEntry>
  settings!:     Table<Setting>

  constructor() {
    super('LanguageResearchApp')

    this.version(1).stores({
      chapters:     '++id, parentId, title, order, createdAt, updatedAt',
      paragraphs:   '++id, chapterId, content, notes, createdAt, updatedAt',
      sentences:    '++id, paragraphId, content, startOffset, endOffset, notes, createdAt',
      words:        '++id, &lemma, translation, notes, createdAt, updatedAt',
      occurrences:  '++id, wordId, paragraphId, sentenceId, [wordId+paragraphId]',
      canvasNodes:  '++id, entityType, entityId, x, y, chapterId',
      images:       '++id, paragraphId, caption, notes, createdAt',
      wordnetCache: '++id, &lemma, synsets, definitions, synonyms, examples',
      settings:     '&key, value'
    })
  }
}

export const db = new AppDatabase()
```

### Compound Index Kullanımı

`[wordId+paragraphId]` → `occurrences` tablosunda aynı kelimenin aynı paragrafa birden fazla eklenmesini önler ve highlight sorgusu için O(1) lookup sağlar.

```typescript
// Occurrence eklerken duplicate kontrolü
await db.occurrences
  .where('[wordId+paragraphId]')
  .equals([wordId, paragraphId])
  .first()
  .then(existing => {
    if (!existing) db.occurrences.add({ wordId, paragraphId, sentenceId, ... })
  })
```

---

## Domain Tipleri

```typescript
// src/types/domain.types.ts

export interface Chapter {
  id?: number
  parentId: number | null       // null = root chapter
  title: string
  order: number                 // chapter sırası (createdAt bazlı)
  createdAt: string             // ISO 8601
  updatedAt: string
}

export interface Paragraph {
  id?: number
  chapterId: number
  content: string               // Ham metin, değişmez
  notes: string                 // Kullanıcı notu
  createdAt: string
  updatedAt: string
}

export interface Sentence {
  id?: number
  paragraphId: number
  content: string               // Snapshot — paragraf değişse bile değişmez
  startOffset: number           // Paragraf içindeki karakter konumu
  endOffset: number
  notes: string
  createdAt: string
}

export interface Word {
  id?: number
  lemma: string                 // Unique — aynı lemma'dan tek kayıt
  translation: string           // Kullanıcının manuel çevirisi
  notes: string
  createdAt: string
  updatedAt: string
}

export interface Occurrence {
  id?: number
  wordId: number
  paragraphId: number
  sentenceId: number | null     // Cümle ile bağlandıysa dolu
}

export interface CanvasNode {
  id?: number
  entityType: 'paragraph' | 'sentence' | 'word' | 'image'
  entityId: number
  x: number
  y: number
  chapterId: number             // Hangi chapter'ın canvas'ına ait
}

export interface Image {
  id?: number
  paragraphId: number
  blob: Blob
  caption: string
  notes: string
  createdAt: string
}

export interface WordnetEntry {
  id?: number
  lemma: string
  synsets: string[]
  definitions: string[]
  synonyms: string[]
  examples: string[]
}

export interface Setting {
  key: string
  value: unknown
}
```

---

## XState Machines

### canvas.machine.ts

```typescript
// Context
interface CanvasContext {
  zoom: number          // default: 1
  panX: number          // default: 0
  panY: number          // default: 0
  draggingNodeId: number | null
  dragOffsetX: number
  dragOffsetY: number
}

// Events
type CanvasEvent =
  | { type: 'ZOOM'; delta: number }
  | { type: 'PAN'; dx: number; dy: number }
  | { type: 'DRAG_START'; nodeId: number; offsetX: number; offsetY: number }
  | { type: 'DRAG_MOVE'; x: number; y: number }
  | { type: 'DRAG_END' }
  | { type: 'RESET_VIEW' }
```

### chapter.machine.ts

```typescript
interface ChapterContext {
  activeChapterId: number | null
  expandedIds: number[]
  sidebarOpen: boolean
}

type ChapterEvent =
  | { type: 'SELECT_CHAPTER'; id: number }
  | { type: 'TOGGLE_EXPAND'; id: number }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'CLOSE_SIDEBAR' }
```

> `SELECT_CHAPTER` event'i tetiklendiğinde `settings` tablosuna `{ key: 'selectedChapterId', value: id }` yazılır.

### selection.machine.ts

```typescript
interface SelectionContext {
  selectedType: 'paragraph' | 'sentence' | 'word' | null
  selectedId: number | null
  connectedIds: ConnectedEntity[]   // rope overlay için
}

interface ConnectedEntity {
  type: 'paragraph' | 'sentence' | 'word'
  id: number
  canvasNodeId: number
}

type SelectionEvent =
  | { type: 'SELECT'; entityType: SelectionContext['selectedType']; id: number }
  | { type: 'DESELECT' }
```

`SELECT` event'i tetiklendiğinde `occurrences` tablosundan bağlı entity'ler sorgulanır ve `connectedIds` güncellenir. Bu güncelleme `RopeOverlay.svelte`'i reaktif olarak tetikler.

### wordnet.machine.ts

```typescript
type WordnetState = 'idle' | 'checking' | 'seeding' | 'done' | 'error'

interface WordnetContext {
  status: WordnetState
  progress: number          // 0–100
  error: string | null
}

type WordnetEvent =
  | { type: 'START_SEED' }
  | { type: 'PROGRESS'; value: number }
  | { type: 'DONE' }
  | { type: 'ERROR'; message: string }
```

---

## WordNet Seeding Pipeline

```
App mount
  │
  ▼
settings['wordnetSeeded'] === true?
  │ YES → FlexSearch index'i wordnetCache'den rebuild (in-memory) → done
  │
  NO
  ▼
wordnet.machine: 'seeding'
  │
  ▼
Web Worker spawn (seed.worker.ts)
  │
  ├── wordnet.json'u fetch (stream ile chunk'lara böl)
  ├── Her chunk:
  │     ├── FlexSearch.add({ lemma, definition, synonyms, examples })
  │     └── db.wordnetCache.bulkAdd(entries)
  ├── postMessage({ type: 'PROGRESS', value: n })
  │
  ▼
Worker done
  ├── settings['wordnetSeeded'] = true
  └── wordnet.machine: 'done'
```

### FlexSearch Konfigürasyonu

```typescript
// src/lib/services/FlexSearchIndex.ts

import FlexSearch from 'flexsearch'

export const wordnetIndex = new FlexSearch.Document({
  document: {
    id: 'lemma',
    index: [
      { field: 'lemma',       tokenize: 'forward', resolution: 9 },
      { field: 'definitions', tokenize: 'strict',  resolution: 5 },
      { field: 'synonyms',    tokenize: 'strict',  resolution: 4 },
      { field: 'examples',    tokenize: 'strict',  resolution: 3 }
    ]
  }
})
```

---

## WordService

```typescript
// src/lib/services/WordService.ts

export class WordService {
  // Lemma zaten varsa mevcut kaydı döner, yoksa yeni oluşturur
  static async upsert(lemma: string): Promise<Word>

  // Kelimeye translation veya not ekler
  static async annotate(wordId: number, data: Partial<Pick<Word, 'translation' | 'notes'>>): Promise<void>

  // Paragraftaki tüm occurrence'ları getirir (highlight için)
  static async getOccurrencesByParagraph(paragraphId: number): Promise<Occurrence[]>

  // Kelimeyle bağlantılı paragrafları getirir
  static async getLinkedParagraphs(wordId: number): Promise<Paragraph[]>

  // Kelimeyle bağlantılı cümleleri getirir
  static async getLinkedSentences(wordId: number): Promise<Sentence[]>

  // WordNet'ten kelime detaylarını getirir (synsets, definitions, vb.)
  static async lookupWordnet(lemma: string): Promise<WordnetEntry | null>
}
```

---

## MorphologyEngine

```typescript
// src/lib/services/MorphologyEngine.ts

export class MorphologyEngine {
  // Ham kelimeyi lemma'ya indirger (running → run, books → book)
  static lemmatize(word: string): string

  // Kelimenin tüm morfolojik formlarını döner
  static getForms(lemma: string): string[]

  // Metinden token listesi üretir (noktalama temizler)
  static tokenize(text: string): string[]

  // Token'ı lemma'ya çevirip WordService.upsert'e hazırlar
  static normalizeToken(token: string): string
}
```

---

## Highlight Mekanizması

Paragraf render edilirken:

```typescript
// src/lib/utils/highlight.ts

export async function buildHighlightedTokens(
  paragraphId: number,
  content: string
): Promise<Token[]> {
  const tokens = MorphologyEngine.tokenize(content)
  const occurrences = await WordService.getOccurrencesByParagraph(paragraphId)
  const highlightedWordIds = new Set(occurrences.map(o => o.wordId))

  const words = await db.words
    .where('id')
    .anyOf([...highlightedWordIds])
    .toArray()

  const lemmaMap = new Map(words.map(w => [w.lemma, w]))

  return tokens.map(token => {
    const lemma = MorphologyEngine.normalizeToken(token.text)
    const word = lemmaMap.get(lemma)
    return {
      text: token.text,
      isHighlighted: !!word,
      wordId: word?.id ?? null,
      translation: word?.translation ?? null
    }
  })
}
```

Yeni kelime eklendiğinde aynı `lemma`ya sahip kayıt varsa:
1. Yeni `Word` oluşturulmaz
2. Sadece `Occurrence` köprüsü eklenir
3. Svelte reaktif store güncellenir → highlight otomatik render edilir

---

## SVG Rope Overlay

./rope-manager.js dosyası kullanılacaktır.
---

## Cümle Ayırma Akışı

```
Kullanıcı paragraf metninde bir aralık seçer
  │
  ▼
SentenceTooltip.svelte tetiklenir (selection API)
  │
  ▼
"Bu cümleyi ayır" butonuna basar
  │
  ▼
parser.ts → seçili aralığın startOffset / endOffset hesaplanır
  │
  ▼
db.sentences.add({
  paragraphId,
  content: selectedText,   // Snapshot — artık değişmez
  startOffset,
  endOffset,
  notes: '',
  createdAt: now()
})
  │
  ▼
Canvas'a yeni CanvasNode eklenir (entityType: 'sentence')
  │
  ▼
Orijinal paragraf metni değişmez, cümle ayrı entity olarak var olmaya başlar
```

---

## Canvas Altyapısı

```
InfinityCanvas.svelte
  ├── overflow: hidden wrapper div
  ├── İç transform div (translateX/Y + scale → pan/zoom)
  │   ├── SVG katmanı (rope overlay — en altta, pointer-events: none)
  │   └── CanvasNode'lar (absolute position, entityType bazlı render)
  └── Minimap.svelte (fixed position, canvas state'ini mirror'lar)
```

- Pan: `pointermove` event'i + `canvas.machine` PAN event
- Zoom: `wheel` event'i + `canvas.machine` ZOOM event
- Drag: `CanvasNode` üzerinde `pointerdown` → `DRAG_START` → `DRAG_MOVE` → `DRAG_END`
- `DRAG_END` sonrası `canvasNodes` tablosundaki x/y güncellenir

### Context Menu

Sağ tık → `ContextMenu.svelte` açılır. Seçilen entity tipine göre farklı aksiyonlar:

| Entity | Aksiyonlar |
|---|---|
| Paragraph | Cümle ayır, kelime ekle, resim ekle, sil |
| Word | Çeviriyi düzenle, not ekle, WordNet'te ara |
| Sentence | Not ekle, paragrafla bağlantıyı kaldır |
| Canvas (boş alan) | Paragraf ekle, chapter bağla |

---

## Chapter Yapısı

```
Chapter (parentId: null)
  └── SubChapter (parentId: chapterId)
        └── SubSubChapter (parentId: subChapterId)

Maksimum derinlik: 3 (chapter → subchapter → subsubchapter)
```

Chapter silindiğinde:

```typescript
async function deleteChapterCascade(chapterId: number): Promise<void> {
  const children = await db.chapters.where('parentId').equals(chapterId).toArray()
  for (const child of children) {
    await deleteChapterCascade(child.id!)
  }
  const paragraphIds = await db.paragraphs
    .where('chapterId').equals(chapterId)
    .primaryKeys()

  await db.transaction('rw',
    [db.chapters, db.paragraphs, db.sentences, db.occurrences, db.canvasNodes, db.images],
    async () => {
      await db.paragraphs.where('chapterId').equals(chapterId).delete()
      await db.sentences.where('paragraphId').anyOf(paragraphIds).delete()
      await db.occurrences.where('paragraphId').anyOf(paragraphIds).delete()
      await db.canvasNodes.where('chapterId').equals(chapterId).delete()
      await db.images.where('paragraphId').anyOf(paragraphIds).delete()
      await db.chapters.delete(chapterId)
    }
  )
}
```

---

## CSS Design System

### Görsel Yapı ve Yerleşim:
Sıkıştırılmış, ultra-kompakt ve düz (flat) bir TUI terminal arayüzü tasarla. Tasarımda padding ve margin değerlerini minimumda tutarak ekran alanını verimlilik odaklı kullan; gölge, gradyan veya 3D derinlik efektlerinden tamamen kaçınarak saf dijital bir minimalizm yakala. Bilgi hiyerarşisini oluştururken keskin köşeli, 1px kalınlığında ince çerçeveler ve monospaced yazı tipleri kullanarak, veriyi bir endüstriyel HUD (Heads-Up Display) ciddiyetinde, ızgara düzenine sadık kalarak yerleştir.

### Renk ve Atmosfer:
Renk paletini OKLCH ve color-mix() tekniklerini temel alan, algısal olarak dengelenmiş soft tonlar üzerine kurgula. Keskin kontrastlar yerine, arka plan renginin farklı oranlarda karıştırılmasıyla elde edilen "deep-slate" ve "muted" tonları kullanarak bölümler arası geçişi sağla; parlaklığı sabit tutarak göz yorgunluğunu minimize et. Vurgu renklerinde yüksek doygunluktan kaçınarak, ana temayla uyumlu, fütüristik bir laboratuvar cihazını andıran, sofistike ve düşük kromalı bir renk geçiş sistemi uygula.

```css
/* src/app.css */

@layer base {
  :root {
    /* Temel 5 renk tonu — oklch */
    --color-bg:        oklch(12% 0.01 260);
    --color-surface:   oklch(17% 0.015 260);
    --color-border:    oklch(28% 0.02 260);
    --color-text:      oklch(85% 0.01 260);
    --color-accent:    oklch(70% 0.15 200);

    /* Türevler — color-mix ile */
    --color-surface-hover:  color-mix(in oklch, var(--color-surface) 80%, var(--color-accent));
    --color-border-active:  color-mix(in oklch, var(--color-border) 50%, var(--color-accent));
    --color-text-muted:     color-mix(in oklch, var(--color-text) 50%, var(--color-bg));

    /* Highlight */
    --color-highlight:      oklch(75% 0.18 85 / 0.25);
    --color-highlight-hover: oklch(75% 0.18 85 / 0.45);

    /* Rope */
    --color-rope:           oklch(60% 0.08 200 / 0.6);

    /* Spacing — compact */
    --space-1: 4px;
    --space-2: 8px;
    --space-3: 12px;
    --space-4: 16px;

    /* Typography */
    --font-mono: 'JetBrains Mono', monospace;
    --font-sans: 'IBM Plex Sans', sans-serif;
    --font-size-sm: 11px;
    --font-size-base: 13px;
    --font-size-lg: 15px;
  }
}

/* Kareli arka plan */
.canvas-grid {
  background-image:
    linear-gradient(var(--color-border) 1px, transparent 1px),
    linear-gradient(90deg, var(--color-border) 1px, transparent 1px);
  background-size: 24px 24px;
  opacity: 0.35;
}
```

---

## Timestamp Kuralları

Her entity'de `createdAt` ve `updatedAt` alanları bulunur. Format: ISO 8601 string.

```typescript
// src/lib/utils/date.ts

export const now = (): string => new Date().toISOString()

export const withTimestamps = <T>(data: T): T & { createdAt: string; updatedAt: string } => ({
  ...data,
  createdAt: now(),
  updatedAt: now()
})

export const withUpdatedAt = <T>(data: T): T & { updatedAt: string } => ({
  ...data,
  updatedAt: now()
})
```

Her `db.add()` çağrısında `withTimestamps()`, her `db.update()` çağrısında `withUpdatedAt()` kullanılır.

---

## Implementation Sırası

```
Faz 0 - Proje oluşturulması
Faz 1 — Temel Altyapı
  1. Dexie schema + migrations (schema.ts)
  2. Domain types (types/)
  3. XState machine skeleton'ları
  4. CSS design system + kareli arka plan

Faz 2 — Canvas Altyapısı
  5. InfinityCanvas.svelte (pan/zoom)
  6. CanvasNode.svelte (drag + persist)
  7. Minimap.svelte

Faz 3 — Chapter / Paragraph CRUD
  8. Chapter sidebar + tree
  9. Paragraph CRUD + notes alanı
  10. Sentence ayırma (tooltip + parser)

Faz 4 — Kelime Sistemi
  11. Word global store + occurrence köprüsü
  12. Highlight mekanizması
  13. WordPopover (hover çeviri)
  14. WordCard + NoteArea

Faz 5 — WordNet
  15. seed.worker.ts (Web Worker)
  16. FlexSearchIndex.ts (index build + search)
  17. WordService.lookupWordnet()
  18. MorphologyEngine

Faz 6 — Bağlantı Görselleştirmesi
  19. rope.ts (SVG path helper)
  20. RopeOverlay.svelte
  21. selection.machine connectedIds

Faz 7 — Tamamlayıcılar
  22. Context menu
  23. Image blob upload + ImageCard
  24. Chapter cascade delete
  25. Settings persistence (selectedChapterId, zoom)
```

---

## Geliştirici Notları

- **Component boyutu:** Hiçbir `.svelte` dosyası 150 satırı geçmemeli. Script kısmı 80 satırı geçiyorsa logic `utils/` veya `services/`'e taşınmalı.
- **Dexie transaction:** Birden fazla tablo etkileyen her write işlemi `db.transaction()` içinde yapılmalı.
- **FlexSearch thread safety:** Index sadece Web Worker içinde build edilir. Ana thread'de sadece sorgu yapılır, `postMessage` ile.
- **Svelte store ile XState:** XState actor'ları Svelte store'a `fromStore` / `writable` ile bağlanır; doğrudan XState state'i template'e bağlamak yerine derived store kullanılır.
- **Blob storage:** Resimler için `db.images.blob` kullanılır. Büyük dosyalar için `URL.createObjectURL()` ile geçici URL üretilir, component destroy'da revoke edilir.
- **CSS:** `oklch()` ve `color-mix()` her modern Chromium/Firefox/Safari'de desteklenir, fallback gerekmez.
