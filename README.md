# SQL Interview Trainer — Capacitor version

Это Capacitor-версия текущего MVP тренажёра SQL-собеседований.

Внутри уже есть:

- `www/index.html` — текущий SQL MVP v3;
- `www/manifest.json` — manifest для PWA/иконки;
- `www/service-worker.js` — простой offline-cache для web/PWA;
- `capacitor.config.json` — настройки Capacitor;
- `android/` — уже сгенерированный Android-проект Capacitor;
- `package.json` — npm-команды для синхронизации и запуска.

## Что нужно установить на компьютере

1. Node.js LTS
2. Android Studio
3. Android SDK внутри Android Studio
4. Java/JDK, обычно Android Studio ставит нужный комплект сама

## Первый запуск

Открой терминал в папке проекта:

```bash
npm install
npm run check
npx cap sync android
npx cap open android
```

После `npx cap open android` откроется Android Studio.

## Как запустить на телефоне Android

1. Включи режим разработчика на телефоне.
2. Включи USB debugging / Отладку по USB.
3. Подключи телефон к компьютеру.
4. В Android Studio выбери телефон в списке устройств.
5. Нажми Run.

## Как собрать APK для ручной установки

В Android Studio:

```text
Build → Build Bundle(s) / APK(s) → Build APK(s)
```

APK появится примерно здесь:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Как собрать AAB для Google Play

В Android Studio:

```text
Build → Generate Signed Bundle / APK → Android App Bundle
```

Для Google Play нужен именно `.aab`, а не обычный debug APK.

## После изменения index.html

Если меняешь `www/index.html`, затем выполни:

```bash
npx cap sync android
```

Эта команда скопирует обновлённый HTML/CSS/JS внутрь Android-проекта.

## Где хранятся данные приложения

Сейчас прогресс и добавленные вопросы сохраняются локально через `localStorage` внутри WebView.

Это значит:

- данные хранятся только на устройстве;
- синхронизации между устройствами пока нет;
- если удалить приложение, данные могут быть потеряны.

Для следующей версии лучше добавить нормальное хранилище: SQLite, Firebase, Supabase или свой backend.

## Рекомендуемый следующий шаг

1. Собрать debug APK.
2. Установить на Android-телефон.
3. Проверить: фильтры, генератор, добавление вопроса в базу, сохранение прогресса.
4. После проверки уже делать нормальную версию v4: больше вопросов, импорт/экспорт базы, ежедневный режим подготовки.
