# Hellenic Bot — Bot UX

The Telegram bot serves as the entry point. It registers users and launches the Mini App. All learning happens inside the Mini App.

## Commands

| Command  | Description                                         |
|----------|-----------------------------------------------------|
| `/start` | Welcome message + register/update user + Open button |

Only one command in v1. The bot does not handle learning interactions, quizzes, or free-text input.

## `/start` Flow

```
User sends /start
    │
    ├── Upsert user (telegram_id, first_name, last_name, username, language_code)
    │
    └── Reply with welcome message + inline keyboard
```

### Welcome Message

Displayed language is based on `display_language` returned by the API after upsert. This respects the user's language preference set in Mini App settings (not just Telegram's `language_code`). Two variants:

**Russian (`ru`):**
```
Привет, {first_name}! 👋

Учи греческие слова с помощью интервального повторения.

Нажми кнопку ниже, чтобы начать.
```

**English (default):**
```
Hi, {first_name}! 👋

Learn Greek vocabulary with spaced repetition.

Tap the button below to get started.
```

### Inline Keyboard

Single button that opens the Mini App:

```
[ 🎓 Open App ]  ← webapp_url (Mini App)
```

Button type: `web_app` (opens Telegram Mini App inline).

## User Registration

On `/start`, the bot delegates user registration to the API:

1. Sends Telegram user data (`telegram_id`, `first_name`, `last_name`, `username`, `language_code`) to `POST /internal/users/upsert`
2. The API upserts the user (see API.md)
3. Bot uses the returned `display_language` to pick the welcome message language

**Note:** The API also upserts users on `POST /auth/validate` (see API.md). Both paths sync the same Telegram profile fields. The bot upsert via API ensures the user exists before the Mini App opens; the `/auth/validate` upsert keeps profile data fresh on each Mini App session.

### Error Handling

If the `POST /internal/users/upsert` call fails (network error, API down):

1. Log the error for monitoring
2. Fall back to Telegram `language_code` from the message to pick the welcome message language (`ru` if Russian, `en` otherwise)
3. Still send the welcome message and Open button — the user can open the Mini App, which will upsert them via `POST /auth/validate`

## Unrecognized Input

Any message other than `/start` gets a short reply pointing the user to the Mini App. Language is determined from Telegram `language_code` in the message: `ru` if Russian, `en` otherwise. No API call is made.

**Note:** This uses the raw Telegram `language_code`, not the user's `display_language` preference from settings. If the user changed their display language in the Mini App, the unrecognized input reply may use a different language than `/start`. This is an accepted trade-off to avoid an API call on every unrecognized message.

**Russian:**
```
Используй приложение для обучения. Нажми /start, чтобы открыть.
```

**English:**
```
Use the app to learn. Tap /start to open it.
```

## Out of Scope (v1)

- Review reminders / scheduled notifications
- Inline queries
- Group chat support
- Learning exercises inside the chat
- `/stats`, `/help`, or other commands
