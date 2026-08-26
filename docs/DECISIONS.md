# Решения

Не пересматривать, пока пользователь явно не попросил.

## v1 — React, не Flutter
Flutter не переписывать, пока флоу не живой.

## Сканер в v1 — мок
Читает `src/fixtures/mailbox.ts` через `src/engine/pipeline.ts`.
Живой Gmail — только когда будет OAuth client id. Шов уже есть: `MailboxHit[]`.

## Почта — Gmail readonly
Scope `gmail.readonly` до кнопки «Отправить». SMS в v1 нет.

## Движок отдельно от UI
`src/engine/*` потом уедет в Cloud Functions. Типы — `src/types.ts`.

## Отмена
Play / Apple / PayPal → их страница подписок (инструкция), не фейковое «отправь письмо».
Web / Stripe → ссылка из письма, иначе известный URL, иначе сайт отправителя.

## Биллинг
3 бесплатные отмены → paywall $29.99 → Pro без лимита. Сейчас mock. Дальше RevenueCat.

## Узкое место продукта
Верификация Google на restricted scope. Без неё в Play нет настоящего сканера.

## TWA / адресная строка в Play APK
Полоска Chrome — это Custom Tab: Digital Asset Links не совпали с подписью APK на телефоне. CSS её не убирает.

- Оба хоста `subkill.app` и `www.subkill.app` отдают `/.well-known/assetlinks.json` с 200, без редиректа. Apex→www редирект не возвращать.
- В `assetlinks.json` нужны **все** SHA-256 ключа подписи Play (quantum-ready: классический для Android 16−, новый классический и PQC для 17+) **и** ключ загрузки (upload), если ставят APK из zip PWABuilder.
- Готовый JSON копировать со страницы Play App Signing, не две строки «классический / постквантовый».
- Service worker не перехватывает `/.well-known/`.
