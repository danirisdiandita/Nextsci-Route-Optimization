# Create the master admin and sign in

The dashboard has no sign-up page. Every account starts on the server. The first account you create is the master admin, a Django superuser. The master admin can sign in to the dashboard and to the Django admin site, and can create accounts for everyone else.

Accounts use an email address and a password. There is no username.

## Before you start

- The API server runs and has applied its migrations. With Docker Compose, the `backend` service does this when it starts. Without Docker, run `moon run backend:migrate`, or `.venv/bin/python manage.py migrate` in `backend/`. `moon run backend:createsuperuser` applies them for you.
- You know which way you run the stack: with Docker Compose, or directly on your computer. Each step below shows both.

## 1. Create the master admin

Run `createsuperuser`. It asks for an email address and a password, then prints `Superuser created successfully.`

With Docker Compose:

```bash
docker compose exec backend python manage.py createsuperuser
```

Without Docker, with [moon](https://moonrepo.dev), from the repository root:

```bash
moon run backend:createsuperuser
```

This task installs the backend's packages and applies migrations first, so it also works on a fresh clone.

Without moon:

```bash
cd backend
.venv/bin/python manage.py createsuperuser
```

To create the account without prompts, for example in a deploy script, set the email and password as environment variables and add `--noinput`:

```bash
DJANGO_SUPERUSER_EMAIL=admin@example.com \
DJANGO_SUPERUSER_PASSWORD='choose-a-long-password' \
moon run backend:createsuperuser -- --noinput
```

> [!WARNING]
> A password in a command line stays in your shell history. On a shared or production server, use the interactive command, or read the password from a secret store.

If the email address already has an account, the command stops with `That email is already taken.` It does not change the existing account.

## 2. Sign in to the dashboard

1. Open the dashboard. In development it runs at http://localhost:5174.
2. Enter the master admin's email address and password.
3. Select **Sign in**. The dashboard shows your email address in the top bar.

## 3. Add accounts for your team

Create dispatcher accounts in the Django admin site. Dispatchers can sign in to the dashboard. They cannot open the admin site.

1. Open http://localhost:8000/admin/ and sign in as the master admin.
2. Under **Accounts**, select **Users**, then **Add user**.
3. Enter the person's email address and a password. Enter the password twice.
4. Select **Save**.

Leave **Staff status** and **Superuser status** cleared for dispatchers. Select them only for people who must manage accounts:

| Setting | What the person can do |
| --- | --- |
| Neither | Sign in to the dashboard |
| Staff status | Also sign in to the admin site, limited to the permissions you grant |
| Superuser status | Also do everything in the admin site, like the master admin |

## Reset a forgotten password

Run `changepassword` with the account's email address. It asks for the new password twice.

```bash
docker compose exec backend python manage.py changepassword admin@example.com
```

Without Docker, run `.venv/bin/python manage.py changepassword admin@example.com` in `backend/`. The master admin can also set a new password on the user's page in the admin site.

## Troubleshooting

**`InconsistentMigrationHistory: Migration admin.0001_initial is applied before its dependency accounts.0001_initial`**

The database was migrated before the project switched to email accounts. Django cannot change the user model of an existing database. On a development database, delete it and create it again, then migrate:

```bash
dropdb -h localhost -U postgres nextsci
createdb -h localhost -U postgres nextsci
cd backend && .venv/bin/python manage.py migrate
```

> [!CAUTION]
> `dropdb` deletes every row in the database. Run it only on a development database that holds nothing you need.

**The dashboard says "Cannot reach the server"**

The API server is not running, or the dashboard proxies to the wrong address. Start the API server on port 8000, or set `API_PROXY_TARGET` before you start the dashboard.

**The dashboard says "The email or password is incorrect"**

Check the email address in the admin site under **Users**. Then reset the password as described above.
