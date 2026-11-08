# زبان طراحی Memora

این سند «قانون» است. اگر چیزی با آن جور نیست، کد عوض می‌شود، نه سند.

> خلاصه: **یک بوم جوهری، یک لهجه، جدایی با پُرشدگی و عمق (نه با کادر)، شیشهٔ مات — و هیچ مقدار بصری‌ای که از `theme/` بیرون بیاید.**
>
> **مرز، قاعده نیست؛ استثناست** (بخش ۱۱). هر سطح با `fill`، فاصله و یک لبهٔ روشن از سطح زیرینش جدا می‌شود.

---

## ۱. منبع واحد حقیقت

```
theme/palette.js        ← تنها جایی که hex / rgba نوشته می‌شود
   ├── tailwind.config.js   → کلاس‌های Tailwind (bg-surface، text-on-surface…)
   └── theme/tokens.ts      → اعداد و رنگ‌ها برای JS (SVG، StyleSheet، آیکن)
```

- `tailwind.config.js` کلیدهای `colors` را به کباب‌کیس تبدیل می‌کند: `onSurfaceVariant` → `text-on-surface-variant`.
- `fills` با پیشوند می‌آیند: `bg-fill-tile`، `bg-fill-control`، `bg-fill-track`…
- هیچ فایلی بیرون `theme/` مجاز نیست hex یا `rgba(…)` بنویسد — `npm run check:design` این را می‌گیرد.

### چرا؟

قبلاً هر صفحه سایه/شیشه/فاصلهٔ خودش را داشت؛ همان صفحه بعد از یک هفته دو رفتار متفاوت داشت. حالا یک تغییر در `palette.js` همه‌جا اعمال می‌شود.

---

## ۲. سطوح (surface levels)

| نقش | کلاس / توکن | کاربرد |
| --- | --- | --- |
| بوم | `bg-background` | پس‌زمینهٔ همهٔ صفحه‌ها (`Screen` این را می‌دهد) |
| پنل صحنه | `Surface tone="scene"` | هیروی امروز، صحنهٔ مطالعه، آرنای کوییز |
| پنل | `Surface tone="pane"` | ردیف‌ها، کارت‌ها، شیت‌ها |
| تودرتو | `Surface tone="inset"` | محتوای داخل یک پنل (پیش‌نمایش، سرصفحهٔ پوشه) |
| کاشی آیکن | `Surface tone="control"` / `bg-fill-tile` | مربع ۳۸/۴۴ پیکسلی آیکن |
| کنترل | `bg-fill-control` | ورودی، دکمهٔ آیکن، ریل سگمنت |
| ریل پیشرفت | `bg-fill-track` | نوار پیشرفت، متر |

پنل‌ها **بدون کادر** و **بدون سایه‌های تزئینی** خوانده می‌شوند: `Surface` + `shadow.pane`. فقط پنل‌های «صحنه» یک `borderWidth` ۱px با `outlineSoft` ۳۰٪ در لبهٔ بالا می‌گیرند؛ کارت‌ها، گروه‌های تنظیمات و پلیت‌ها هیچ لبه‌ای ندارند. عناصر داخل پنل (کاشی آیکن، ردیف، ورودی) یک پله روشن‌تر از پنل‌اند، پس هیچ‌کدام کادر نمی‌خواهند. برای پنل تیره‌تر/تأکیدی: `Surface tone="inset"` (فقط پرکننده، بدون خط تأکید). سرصفحهٔ پوشه در Home یک `Surface tone="inset"` است، نه پنل.

سلسله‌ی `fills` همان مقیاس عمق است و عوض شده تا بدون کادر هم تفکیک دیده شود:
`subtle 0.03 → inset 0.05 → tile 0.06 → control 0.075 → track 0.09`.

---

## ۳. رنگ معنادار

هر رنگ یک معنا دارد و آن معنا در همهٔ صفحه‌ها ثابت است.

| توکن | معنا | کجا |
| --- | --- | --- |
| `primary` | لهجه، اقدام اصلی | دکمهٔ اصلی، تب فعال، انتخاب |
| `stateColors.New` | کارت تازه | ریل تسلط، لجر، دونات |
| `stateColors.Learning` / `Relearning` | در حال یادگیری | همان‌ها |
| `stateColors.Review` | مرور (تسلط) | همان‌ها |
| `error` | بازخورد منفی، حذف | «دوباره» در پایان جلسه |
| `success` | نتیجهٔ مثبت | «آسان»، ذخیرهٔ موفق |
| `warning` | توجه غیرخطا | وضعیت یادگیری، هشدار |

نتیجه: در [statistics](app/statistics.tsx) رنگ‌های دونات و لجند از `stateColors` می‌آیند، دقیقاً همان‌هایی که [rail تسلط](app/deck/[id].tsx) استفاده می‌کند. رنگ تزئینی در سیستم وجود ندارد.

**تنها استثنا: رنگ دِک و رنگ کارت.** رنگ هر دِک دادهٔ کاربر است (نه انتخاب طراحی)، پس `deck.color` به `DeckCard`/`DeckListItem` می‌رسد و همیشه با `alpha(color, …)` کم‌رنگ می‌شود. رنگ کارت (`Flashcard.color`) هم از همان پالت انتخاب می‌شود و با `over(base, color, amount)` در سطح کارت حل می‌شود — چون استایل‌های React Native دو پس‌زمینه را روی هم نمی‌گذارند. در خود کامپوننت‌ها هیچ hex‌ای نوشته نمی‌شود.

---

## ۴. تایپوگرافی

`AppText` تنها راه نوشتن متن است. `Text` خام از `react-native` در صفحه‌ها استفاده نمی‌شود (چون فونت و رنگ پیش‌فرض را دور می‌زند).

```tsx
<AppText variant="headline">عنوان بخش</AppText>
<AppText variant="bodySm" tone="muted">زیرنویس</AppText>
<AppText variant="label" tone="primary">برچسب</AppText>
```

| variant | اندازه / ارتفاع خط | وزن | کاربرد |
| --- | --- | --- | --- |
| `display` | ۳۴ / ۴۰ | ۷۰۰ | عدد قهرمان، روی کارت |
| `title` | ۲۶ / ۳۲ | ۷۰۰ | عنوان صفحه |
| `headline` | ۲۰ / ۲۷ | ۶۰۰ | عنوان بخش، متن کارت |
| `bodyLg` | ۱۷ / ۲۵ | ۴۰۰ | متن اصلی برجسته |
| `body` | ۱۵ / ۲۲ | ۴۰۰ | متن پیش‌فرض |
| `bodySm` | ۱۳ / ۲۰ | ۴۰۰ | توضیح، متادیتا |
| `label` | ۱۲ / ۱۶ | ۶۰۰ | برچسب کوچک، شمارنده |
| `caption` | ۱۱ / ۱۵ | ۵۰۰ | ریزترین لایه |

`tone`: `default` · `muted` · `tertiary` · `accent` · `onAccent` · `danger` · `success` · `warning`.
وزن را با کلاس `font-inter-*` عوض نکنید مگر واقعاً لازم باشد؛ `variant` وزن درست را دارد.

**پله‌های عدد درشت** بیرون از `variant` هستند و در `theme/v3.ts` تعریف می‌شوند: `v3.type.hero` ۴۰/۴۴ برای عدد قهرمان هر صفحه (و `heroWide` ۵۶/۵۸ از ۹۰۰px به بالا)، `v3.type.score` ۴۴/۴۸ برای امتیاز جاری کوییز و `v3.type.result` ۶۴/۶۸ برای نتیجهٔ پایان دور. هیچ صفحه‌ای عدد نمایشی خودش را inline تعریف نمی‌کند؛ اگر پلهٔ تازه‌ای لازم شد، به همین فهرست اضافه می‌شود.

این پله‌ها روی وب با `rem` نوشته می‌شوند (روی native همان پیکسل منطقی می‌مانند)، چون `AppText` از مقیاس rem تیلویند می‌آید و بزرگ‌نمایی ۲۰۰٪ متن مرورگر باید هر دو را بزرگ کند.

---

## ۵. فاصله و چیدمان

| توکن | مقدار | کاربرد |
| --- | --- | --- |
| `spacing.screen` | ۲۰ | حاشیهٔ افقی صفحه |
| `spacing.gutter` | ۱۶ | فاصلهٔ داخلی پنل‌ها |
| `spacing.row` | ۱۶ | فاصلهٔ بین عنوان و مقدار در یک ردیف |
| `spacing.section` | ۲۸ | فاصلهٔ بین بخش‌ها |
| `spacing.tabClearance` | ۱۱۲ | فضای انتهای صفحه‌های تب‌دار |
| `spacing.screenBottom` | ۴۰ | فضای انتهای صفحه‌های بدون تب |

**صفحه‌ها حاشیهٔ افقی خودشان را تعیین نمی‌کنند.** `Screen` پس‌زمینهٔ تخت، safe area، نوار بالای ثابت، بدنهٔ اسکرول‌شونده و فضای انتهایی را می‌دهد.

```tsx
<Screen
  scroll        // بدنه را اسکرول‌شونده کن
  gutter        // حاشیهٔ افقی ۲۰px استاندارد
  tabClearance  // ۱۰۴px فضای انتهای صفحه‌های تب‌دار
  header={<PageHeader title="کتابخانه" back />}
>
  <SectionHeading title="دسته‌بندی" />
  <Surface tone="pane">…</Surface>
</Screen>
```

- `header` / `footer`: نوار بالای ثابت و فوتر ثابت (دکمهٔ اصلی، ردیف امتیاز).
- `scroll` + `gutter` + `tabClearance`: سه سوئیچ همیشگی؛ `paddingHorizontal` دستی روی صفحه نگذارید.
- صفحه‌های تب‌دار: `tabClearance`؛ صفحه‌های پشته‌ای (back): فقط `scroll gutter`.
- `className`/`contentClassName` فقط برای استثنا (مثلاً `pt-0`) — نه برای بازنویسی پدینگ استاندارد.

---

## ۶. شعاع، ارتفاع، آیکن

| نقش | مقدار | استفاده |
| --- | --- | --- |
| `radii.micro` | ۱۰ | داخل کنترل‌ها، تایل آیکن |
| `radii.control` | ۱۴ | دکمه، ورودی، سگمنت |
| `radii.pane` | ۲۴ | کارت، پنل شیشه‌ای |
| `radii.sheet` | ۲۸ | شیت پایین |
| `radii.pill` | ۹۹۹۹ | چیپ، قرص |

ارتفاع‌ها فقط از `heights`: `button` ۵۲، `field` ۴۴، `row` ۶۰، `pageHeader` ۶۴، `icon` ۳۸، `tile` ۳۸، `tileLg` ۴۴، `hit` ۴۴…
اندازهٔ آیکن از `iconSize`: `xs` ۱۳ → `display` ۲۸. هیچ `<MaterialIcons size={18}>` دستی نیست.

---

## ۷. حرکت

| توکن | مقدار | کاربرد |
| --- | --- | --- |
| `motion.fast` | ۱۶۰ms | بازخورد فشردن |
| `motion.base` | ۲۶۰ms | ظاهر شدن شیت |
| `motion.slow` | ۴۲۰ms | انتقال بزرگ |
| `motion.flip` | ۴۸۰ms | چرخش کارت |
| `motion.spring` | speed 45 · bounciness 0 | کشش/فلیپ |

هیچ صفحه‌ای `Animated` را مستقیم صدا نمی‌زند. همهٔ حرکت از [`motion/`](motion/index.ts) می‌آید:

| ابزار | کار |
| --- | --- |
| `useReveal(key, { delay, duration, distance, scale })` | ورود ۰→۱ (fade + rise). با تغییر `key` دوباره اجرا می‌شود — مثلاً تغییر فیلتر/مرتب‌سازی لجر |
| `usePressFeedback({ scale })` | فنر فشردن؛ مقدار خام را هم می‌دهد تا پردهٔ فشردن را با آن بکشید |
| `timingTo(value, to, { duration, delay, easing, nativeDriver })` | یک گام زمان‌بندی‌شده؛ Promise برمی‌گرداند تا توالی بنویسید (خروج کارت → کارت بعدی) |
| `springTo(value, to)` | فنر، برای فشار/کشش |
| `prefersReducedMotion()` / `useReducedMotion()` | احترام به تنظیم سیستم |

قاعده‌ها:

- `Animated.timing` و `Animated.spring` در صفحه‌ها ممنوع؛ فقط `timingTo`/`springTo`.
- هر حرکت باید مسیر reduce-motion داشته باشد؛ helperها خودشان در لحظهٔ شروع چک می‌کنند و مقدار نهایی را فوری می‌گذارند.
- برای عرض/ارتفاع `nativeDriver: false` بدهید (بقیه پیش‌فرض پلتفرم است).
- حرکت فقط جایی که معنا دارد: ورود بخش‌های صفحه، تغییر فیلتر/ترتیب، فشار، برگشت کارت، و خروج کارت پس از امتیاز. تزئین اضافه نکنید.
- خروج کارت پیش از به‌روزرسانی برنامه انجام می‌شود تا کارت بعدی «می‌رسد»، نه اینکه محتوای قبلی به چیدمان جدید بپرد.

---

## ۸. کاتالوگ کامپوننت

همه از `@components/index` قابل import هستند.

**چیدمان و سطح:** `Screen` (+ `ScreenScroll`, `ScreenBody`) · `Surface` (`scene`/`pane`/`inset`/`control`) · `PageHeader` (+ `HeaderIcon`, `HeaderProfileButton`) · `SectionHeading` · `ShelfHeader` · `ListRow` · `FolderGroup` · `DeckShelfRow` · `ArchivedRow` · `TodayPane` · `BottomSheetModal` + `SheetPanel`

**تنظیمات:** `SettingsHero` · `SettingsChapter` · `SettingsLine` · `SettingsFootnote` · `SettingsBackHeader` · `MetricGrid`

**کنترل:** `Button` (`primary` / `primaryQuiet` / `secondary` / `outline` / `text`، به‌همراه پرچم `destructive` و اندازه‌های `md`/`lg`) · `PrimaryButton` · `GhostButton` · `IconButton` · `ToggleSwitch` · `SearchBar` · `Chip` (`filter`/`select`) · `SegmentedControl` · `Stepper` · `Field` · `Pill` (`neutral`/`accent`/`warning`) · `Menu` / `Select` / `ActionMenu` / `ContextMenu` · `AppearancePicker`

**محتوا:** `StudyCard` · `FlashcardView` · `CardStack` · `SegmentedProgressBar` · `RatingKeys` · `RadioOptionCard` · `LearningStepRow` · `QuizAnswer` · `DonutChart` · `MiniBarChart` · `ActionButton` · `EmptyState`

### قوانین کامپوننت

1. **`ListRow` تنها ردیف استاندارد است** — `title`, `subtitle`, `icon`, `value`, `tile` (`sm`/`lg`/`none`), `density` (`compact`/`default`/`tall`), `iconTone`, `trailing`, `showChevron`, `highlighted`, `onPress`. ردیف دست‌ساز (`<Pressable>` + سه `<AppText>`) جدید نسازید. ردیف‌ها خط جداکننده ندارند؛ `divider` فقط برای سازگاری نگه داشته شده و چیزی رسم نمی‌کند — ردیف‌ها با ارتفاع و پدینگ پنل از هم جدا می‌شوند.
2. **`Surface` تنها پنل است** — `tone` (`scene`/`pane`/`inset`/`control`)، `radius` (`control`/`card`/`pane`)، `padding` (`none`/`sm`/`md`). روی `Surface` کلاس `p-*` تکراری نگذارید. هر صفحه حداکثر یک `tone="scene"` دارد.
3. **`SettingsHero` آغاز صفحهٔ تنظیمات است** — یک `Surface`، یک عنوان، و دفترِ خوانده‌ها (ledger) با اعداد هم‌تراز. سپس `SettingsChapter` با `SettingsLine`ها؛ آخرین خط هر فصل `last` می‌گیرد.
4. **`Button` ارتفاع و شعاع و رنگ را خودش می‌داند**؛ `className` فقط برای عرض/آرایش (`flex-1`, `self-stretch`).
5. **شیت‌ها با `BottomSheetModal` + `SheetPanel`**؛ ارتفاع از `heights.sheet*` — نه `Animated.View` دست‌ساز. منوها از `Menu`/`Select`؛ هیچ منوی دست‌ساز تازه‌ای نسازید.
6. **حالت خالی با `EmptyState`** (`icon`, `title`, `description`, `action`) داخل یک `Surface tone="pane"` — نه پنل نقطه‌چین اختصاصی.
7. **لیست‌های مجازی** (لجر کارت‌های دِک) تنها جایی هستند که پنل از ردیف‌ها ساخته می‌شود: فریم هر ردیف فقط از `glassFill`, `colors.hairline`, `rimColor`, `radii.pane` و `spacing` ساخته شود و اولین/آخرین ردیف گوشه‌ها و ریم پنل را بکشند. ردیف باید یک `Pressable` کامل با `accessibilityRole="button"` باشد، نه یک آیکن کوچک.

---

## ۹. نگهبان‌ها

```bash
npm run check:design   # رنگ خام بیرون theme/ → خطا
npx tsc --noEmit       # قرارداد تایپ‌ها
npm test
```

`check:design` فقط رنگ را می‌گیرد. سایر قوانین این سند در بازبینی بررسی می‌شوند؛ اگر می‌خواهید خودکار شوند، یک قاعده به `scripts/check-design-tokens.mjs` اضافه کنید (مثلاً ممنوعیت `TouchableOpacity` یا `Text` خام).

### استثنا

فقط جایی که ریاضیات لازم است (مثل ارتفاع خط مخصوص متن فارسی در `Flashcard`) می‌توانید خط را با `// design-ignore` علامت بزنید. رنگ هرگز استثنا ندارد.

---

## ۱۰. مرز (border)

مرز فقط جایی می‌آید که **معنا** دارد. فهرست کامل مجازها:

| مورد | کجا |
| --- | --- |
| رینگ فوکوس | `SearchBar` (و هر ورودی‌ای که فوکوس بصری می‌خواهد) |
| وضعیت انتخاب‌شده | `RadioOptionCard` (نقطهٔ رادیو) |
| کادر خالی، نقطه‌چین | فریم حالت خالی، دکمهٔ «افزودن مرحله» |
| `rim` بالای شیشه | یک لبه، فقط در `Surface tone="scene"` (`TodayPane`، صحنهٔ مطالعه، آرنای کوییز) و کاشی‌های پاسخ کوییز |
| خط راهنمای پوشه | `FolderGroup` (یک `borderStartWidth` ۱px برای تودرتویی، نه کادر) |
| هندل شیت | `SheetPanel` (یک پُرشدگی، نه کادر) |

هر چیز دیگری با **پُرشدگی** جدا می‌شود. یک عنصر هرگز هم‌زمان کادر + rim + سایه ندارد.

عدد فعلی: پروژه از ۱۶۰ ارجاع مرز به کمتر از ۲۰ رسیده و همهٔ موارد باقی‌مانده در جدول بالا هستند. صفحهٔ Import که ده‌ها کادر نقطه‌چین و مُهر تزئینی داشت حالا هیچ مرزی ندارد. هیچ `GlassCard`/`TopAppBar`/`v2`ای در کد نمانده است.

## ۱۱. چک‌لیست صفحهٔ جدید

- [ ] `<Screen scroll gutter>` (و `tabClearance` در تب‌ها) با `header={<PageHeader title="…" />}` — بدون حاشیهٔ دستی
- [ ] همهٔ متن‌ها `AppText` با `variant` مناسب؛ هیچ `Text` خام
- [ ] همهٔ پنل‌ها `Surface`؛ هیچ `View` با `borderRadius` و `backgroundColor` دستی و **هیچ `border` تازه‌ای**
- [ ] عرض ستون محتوا از `v3.layout.contentMaxWidth` — بدون `max-w-[…]` دستی
- [ ] هدف لمسی هر کنترل ≥ ۴۴px (`heights.hit` / `hitSlop`)
- [ ] ردیف‌ها `ListRow`؛ دکمه‌ها `Button`/`IconButton`؛ چیپ‌ها `Chip`
- [ ] فاصله‌ها از `v3.spacing`/`spacing`/کلاس‌های `gap-*` — بدون عدد جادویی
- [ ] رنگ‌ها فقط از توکن؛ `npm run check:design` پاس
- [ ] کارت‌ها/شیت‌ها/آیکن‌ها با `heights`, `radii`, `iconSize`
- [ ] انیمیشن با `motion`؛ مسیر reduced-motion تست شده
- [ ] در وب و عرض باریک هم چیده می‌شود (حداقل یک بار اسکرین‌شات)
