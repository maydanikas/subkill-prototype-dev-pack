# Архитектура

Клиент: Vite + React + Tailwind, `npm run dev` → порт 5174.

| Место | Зачем |
|---|---|
| `src/App.tsx` | Экраны: онбординг → скан → дашборд. Paywall после 3 отмен (пока mock). |
| `src/Paywall.tsx` | Лист Pro: $2.99/мес или $19.99/год (только живой Gmail) |
| `src/DemoGate.tsx` | Конец демо: не касса, а выход в Gmail / на старт |
| `src/KillSheet.tsx` | Лист отмены: ссылка / AI-письмо / инструкция Apple·Play |
| `src/types.ts` | Канон типов. Flutter и Cloud Functions должны совпадать с ним |
| `src/engine/*` | Скоринг, дубликаты, маршруты отмены. Потом уедет в Cloud Functions |
| `src/engine/pipeline.ts` | Вход: `MailboxHit[]` → scored подписки |
| `src/api/gmail.ts` | Живой Gmail readonly. Кнопка «Подключить Gmail», если задан `VITE_GOOGLE_CLIENT_ID` |
| `src/fixtures/mailbox.ts` | Демо-ящик (кнопка «Сначала демо») |
| `src/i18n/` | Переводы. Новые строки — во все локали |
| `data/*.json` | Цены, медианы категорий, URL отмены, группы дубликатов |
| `schema/postgres.sql` | Логическая схема (можно 1:1 в Firestore) |

Шов сканера: и мок, и Gmail дают один тип `MailboxHit[]`.

Биллинг (когда снимем mock): один PWA, два кассира, два SKU Pro ($2.99/мес и $19.99/год). TWA → Play Billing (Digital Goods API). Браузер → веб-эквайринг. Оба пишут `users.plan`. Подробности — `docs/DECISIONS.md`.
