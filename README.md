# SubKill

Я собираю продукт в этом репо. React — клиент v1. Flutter не переписываю, пока флоу не живой.

```bash
npm install
npm run dev
```

## Что уже кликается

1. Онбординг → Gmail readonly (демо, без Google Cloud)
2. Скан в 3 прохода
3. Дашборд: годовая сумма, red pills (score ≥ 70), pie с живых категорий
4. Список со Waste Score и причиной: забытая / дорого / дубликат / триал-ловушка
5. Фильтры: Все / Забытые / Дорогие / Дубликаты
6. Убийство: прямая ссылка / AI-письмо / инструкция Apple·Play
7. 3 бесплатные отмены → paywall $29.99 → Pro без лимита

## Пока мок

Сканер читает `src/fixtures/mailbox.ts` через `src/engine/pipeline.ts`. Живой Gmail — когда будет OAuth client id. Шов уже есть: тот же `MailboxHit[]`.

## Стек, из которого исхожу

| | |
|---|---|
| UI | этот Vite/React, дизайн Android 14 |
| Движок | `src/engine/*` — его же унесем в Cloud Functions |
| Почта | Gmail API, scope `gmail.readonly` до кнопки «Отправить» |
| SMS | не трогаю в v1 |
| Биллинг | mock Pro; дальше RevenueCat |

## Критический путь

Верификация Google на restricted scope. Без неё в Play нет настоящего сканера.
