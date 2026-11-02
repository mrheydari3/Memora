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
| پنل شیشه‌ای | `GlassCard` / `glassFill` | کارت، شیت، نوار ابزار، ریل تب |
| تودرتو | `bg-fill-inset` | محتوای داخل یک پنل (پیش‌نمایش، سطر فرم) |
| کاشی آیکن | `bg-fill-tile` | مربع ۳۸/۴۴ پیکسلی آیکن |
| کنترل | `bg-fill-control` | ورودی، دکمهٔ آیکن، ریل سگمنت |
| ریل پیشرفت | `bg-fill-track` | نوار پیشرفت، متر |

پنل‌ها **بدون کادر** و **بدون سایه‌های تزئینی** خوانده می‌شوند: `glassFill` + یک `rimColor` (خط ۱px روشن فقط در لبهٔ بالا) + `shadow.pane`. عناصر داخل پنل (کاشی آیکن، ردیف، ورودی) یک پله روشن‌تر از پنل‌اند، پس هیچ‌کدام کادر نمی‌خواهند. برای پنل تیره‌تر/تأکیدی: `GlassCard tone="accent"` (فقط پرکننده، بدون خط تأکید).

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

**تنها استثنا: رنگ دِک.** رنگ هر دِک دادهٔ کاربر است (نه انتخاب طراحی)، پس `deck.color` به `DeckCard`/`DeckListItem` می‌رسد و همیشه با `alpha(color, …)` کم‌رنگ می‌شود. در خود کامپوننت هیچ hex‌ای نوشته نمی‌شود.

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

---

## ۵. فاصله و چیدمان

| توکن | مقدار | کاربرد |
| --- | --- | --- |
| `spacing.screen` | ۲۰ | حاشیهٔ افقی صفحه |
| `spacing.gutter` | ۱۶ | فاصلهٔ داخلی پنل‌ها |
| `spacing.row` | ۱۶ | فاصلهٔ بین عنوان و مقدار در یک ردیف |
| `spacing.section` | ۲۸ | فاصلهٔ بین بخش‌ها |
| `spacing.tabClearance` | ۱۰۴ | فضای انتهای صفحه‌های تب‌دار |
| `spacing.screenBottom` | ۴۰ | فضای انتهای صفحه‌های بدون تب |

**صفحه‌ها حاشیهٔ افقی خودشان را تعیین نمی‌کنند.** `Screen` پس‌زمینه، `AmbientBackdrop`، safe area، نوار بالای ثابت، بدنهٔ اسکرول‌شونده و فضای انتهایی را می‌دهد.

```tsx
<Screen
  scroll        // بدنه را اسکرول‌شونده کن
  gutter        // حاشیهٔ افقی ۲۰px استاندارد
  tabClearance  // ۱۰۴px فضای انتهای صفحه‌های تب‌دار
  header={<TopAppBar title="کتابخانه" />}
>
  <SectionHeader title="دسته‌بندی" />
  <GlassCard>…</GlassCard>
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

ارتفاع‌ها فقط از `heights`: `button` ۵۲، `field` ۴۴، `row` ۵۸، `icon` ۳۸، `tile` ۳۸، `tileLg` ۴۴، `appbar` ۵۶…
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

**چیدمان و سطح:** `Screen` (+ `ScreenScroll`, `ScreenBody`, `AmbientBackdrop`) · `GlassCard` · `SectionHeader` · `ListRow` · `TopAppBar` · `BottomSheetModal` + `SheetPanel`

**کنترل:** `Button` (`primary` / `primaryQuiet` / `secondary` / `outline` / `text`، به‌همراه پرچم `destructive` و اندازه‌های `md`/`lg`) · `PrimaryButton` · `GhostButton` · `IconButton` · `ToggleSwitch` · `SearchBar` · `Chip` (`filter`/`select`) · `SegmentedControl` · `Stepper` · `Field` · `Pill` (`neutral`/`accent`/`warning`)

**محتوا:** `DeckCard` · `DeckListItem` · `SettingsPlate` · `SettingsSection` + `SettingsCard` + `SettingsRow` · `SettingsNote` · `StatPill` · `FlashcardView` · `SegmentedProgressBar` · `RatingButtonRow` · `RadioOptionCard` · `LearningStepRow` · `RichTextField` · `AchievementBadge` · `DonutChart` · `MiniBarChart` · `EmptyState`

### قوانین کامپوننت

1. **`ListRow` تنها ردیف استاندارد است** — `title`, `subtitle`, `icon`, `value`, `tile` (`sm`/`lg`/`none`), `density` (`compact`/`default`/`tall`), `iconTone`, `trailing`, `showChevron`, `highlighted`, `onPress`. ردیف دست‌ساز (`<Pressable>` + سه `<AppText>`) جدید نسازید. ردیف‌ها خط جداکننده ندارند؛ `divider` فقط برای سازگاری نگه داشته شده و چیزی رسم نمی‌کند — ردیف‌ها با ارتفاع و پدینگ پنل از هم جدا می‌شوند.
2. **`GlassCard` پدینگ خودش را دارد** — `padding` (`none`/`sm`/`md`)، `tone` (`glass`/`accent`/`inset`)، `rim`, `radius`. روی `GlassCard` کلاس `p-*` تکراری نگذارید. پنلِ «امروز» هر صفحه `tone="accent"` است و هر صفحه حداکثر یکی دارد.
3. **`SettingsPlate` آغاز هر صفحهٔ تنظیمات است** — یک پنل، یک عنوان، و دفترِ خوانده‌ها (ledger) با اعداد هم‌تراز؛ فقط صفحهٔ فهرست تنظیمات تُن accent دارد.
3. **`SettingsSection` ریتم تنظیمات را می‌دهد** — هر بخش تنظیمات = `SettingsSection` با `label` و `SettingsRow`های داخلش. فاصلهٔ ۲۸px بالای بخش و ۱۲px بالای کارت را خودش می‌دهد؛ برای اولین بخشِ یک صفحه `first` بدهید. `rule` دیگر خط رسم نمی‌کند؛ بخش‌ها فقط با فاصله جدا می‌شوند. مقدارهای سمت راست را با `value` بگذارید (خودش chevron را کنار مقدار می‌آورد)، نه با `trailing` دست‌ساز.
4. **`Button` ارتفاع و شعاع و رنگ را خودش می‌داند**؛ `className` فقط برای عرض/آرایش (`flex-1`, `self-stretch`).
5. **شیت‌ها با `BottomSheetModal` + `SheetPanel`**؛ ارتفاع از `heights.sheet*` — نه `Animated.View` دست‌ساز.
6. **حالت خالی با `EmptyState`** (`icon`, `title`, `description`, `action`) داخل یک `GlassCard` — نه پنل نقطه‌چین اختصاصی.
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

## ۱۱. مرز (border)

مرز فقط جایی می‌آید که **معنا** دارد. فهرست کامل مجازها:

| مورد | کجا |
| --- | --- |
| رینگ فوکوس | `SearchBar` (و هر ورودی‌ای که فوکوس بصری می‌خواهد) |
| وضعیت انتخاب‌شده | `RadioOptionCard` (نقطهٔ رادیو) |
| کادر خالی، نقطه‌چین | فریم حالت خالی، دکمهٔ «افزودن مرحله» |
| `rim` بالای شیشه | یک لبه در `GlassCard` / `Flashcard` / `CardStack` / `RatingButtonRow` |
| هندل شیت | `SheetPanel` (یک پُرشدگی، نه کادر) |

هر چیز دیگری با **پُرشدگی** جدا می‌شود. یک عنصر هرگز هم‌زمان کادر + rim + سایه ندارد.

عدد فعلی: پروژه از ۱۶۰ ارجاع مرز به ۱۸ رسیده (‏۸۹٪ کاهش) و آن ۱۸ مورد همه در جدول بالا هستند.

## ۱۰. چک‌لیست صفحهٔ جدید

- [ ] `<Screen scroll gutter>` (و `tabClearance` در تب‌ها) با `header={<TopAppBar title="…" />}` — بدون حاشیهٔ دستی
- [ ] همهٔ متن‌ها `AppText` با `variant` مناسب؛ هیچ `Text` خام
- [ ] همهٔ پنل‌ها `GlassCard`؛ هیچ `View` با `borderRadius` و `backgroundColor` دستی و **هیچ `border` تازه‌ای**
- [ ] عرض ستون محتوا از `layout.contentMaxWidth` — بدون `max-w-[…]` دستی
- [ ] هدف لمسی هر کنترل ≥ ۴۴px (`heights.hit` / `hitSlop`)
- [ ] ردیف‌ها `ListRow`؛ دکمه‌ها `Button`/`IconButton`؛ چیپ‌ها `Chip`
- [ ] فاصله‌ها از `spacing`/کلاس‌های `gap-*` — بدون عدد جادویی
- [ ] رنگ‌ها فقط از توکن؛ `npm run check:design` پاس
- [ ] کارت‌ها/شیت‌ها/آیکن‌ها با `heights`, `radii`, `iconSize`
- [ ] انیمیشن با `motion`
- [ ] در وب و عرض باریک هم چیده می‌شود (حداقل یک بار اسکرین‌شات)
