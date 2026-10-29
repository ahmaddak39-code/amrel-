# AMREL — интернет-магазин

Витрина, каталог, корзина, заказы и закрытая панель администратора.
Два режима хранения, переключаются автоматически:

| Где работает | Товары и заказы | Фото |
|---|---|---|
| На вашем MacBook (`npm start`) | файл `data/amrel.db` | папка `data/uploads` |
| На Vercel (публичный сайт) | база Supabase (Postgres) | хранилище Supabase |

## Запуск на MacBook

1. Установите Node.js 22 или новее: https://nodejs.org (кнопка LTS).
2. Терминал:
   ```
   cd ~/Downloads/amrel
   npm install
   npm start
   ```
3. Сайт: http://localhost:3000 · Вход администратора: http://localhost:3000/admin/login
   Начальный пароль уже настроен (в `.env` лежит только его хеш).

## Публикация на Vercel (постоянная ссылка для покупателей)

### Шаг 1. Supabase — база и хранилище фото (бесплатно)
1. https://supabase.com → Start your project → войдите (можно через GitHub или почту).
2. New project → имя `amrel`, придумайте пароль базы (сохраните его), регион — Europe (Frankfurt) → Create.
3. Слева **SQL Editor** → New query → вставьте весь файл `supabase/setup.sql` → **Run**. Должно быть «Success».
4. Слева **Project Settings → API**: скопируйте
   - **Project URL** (вида `https://xxxx.supabase.co`)
   - секретный ключ: **service_role** (вкладка Legacy API Keys) или **Secret key** (`sb_secret_…`).
   Этот ключ секретный: не публикуйте и не вставляйте его в код.

### Шаг 2. Vercel
1. https://vercel.com → Sign Up (можно через почту или GitHub).
2. В Терминале, в папке проекта:
   ```
   npx vercel
   ```
   Войдите в браузере, затем ответьте: Set up and deploy → **Y**, scope — ваш аккаунт, Link to existing → **N**, имя проекта — `amrel`, папка — `./`, менять настройки — **N**.
3. Откройте проект на vercel.com → **Settings → Environment Variables** и добавьте 3 переменные (для Production и Preview):
   - `SUPABASE_URL` — Project URL из шага 1
   - `SUPABASE_SERVICE_ROLE_KEY` — секретный ключ из шага 1
   - `ADMIN_PASSWORD_HASH` — значение из файла `.env` (строка после `ADMIN_PASSWORD_HASH=`)
4. Публикация:
   ```
   npx vercel --prod
   ```
   Терминал покажет адрес вида `https://amrel-xxxx.vercel.app`.

### Шаг 3. Проверка
- `https://ваш-адрес.vercel.app/api/health` → должно быть `"ok":true`, `"database":true`, `"photos":true`.
- Откройте сайт, каталог, войдите в `/admin/login`, добавьте тестовое фото.
- Сразу смените пароль: Панель → **Пароль и доступ**.

Обновить сайт после изменений в коде: `npx vercel --prod`.
Свой домен: Vercel → проект → Settings → Domains.

## Пароль администратора
- Начальный пароль задаётся секретом `ADMIN_PASSWORD_HASH` (хеш scrypt, не сам пароль).
- Сменить: Панель → **Пароль и доступ**. Новый хеш сохраняется в базе и заменяет начальный; все другие устройства выходят из панели.
- Забыли пароль: `npm run set-password` → новый хеш в `.env` и в Терминале → вставьте его в Vercel (`ADMIN_PASSWORD_HASH`) → в Supabase в таблице `settings` удалите строку `_admin_password_hash` → Redeploy.

## Проверки
При запущенном сайте: `TEST_PASSWORD=ваш_пароль npm test` (38 проверок: закрытость админки, вход, фото, заказы, смена пароля).
