# Employee Dashboard Application

This workspace includes a minimal employee dashboard with a login page and a small Node.js backend that supports a superuser adding new users.

## Features

- **Static front end**: dashboard, login, and add-user pages serve HTML/CSS/JS.
- **Express server**: handles authentication, session management, and user creation.
- **User store**: simple `users.json` file with bcrypt-hashed passwords.
- **Superuser role**: only the superuser can create additional users.

## Getting Started

1. Ensure you have **Node.js** and **npm** installed.
2. From the project root, run:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open a browser and go to `http://localhost:3000`.

On first run the server will create a default superuser with credentials:

- **username**: `admin`
- **password**: `adminpass`

> **Important**: change the default password immediately by logging in
> and running `/user` endpoint or editing `users.json` manually.

## Adding users

After signing in as a superuser, visit the **Add User** page (link
appears on the dashboard). Fill in a username, password, and role
(`user` or `superuser`), then submit.

New user entries are appended to `users.json` with the password stored
as a bcrypt hash.

## Security Notes

Long-term production systems should use a proper database, strong
session storage, HTTPS, environment-based secrets, input validation, and
rate limiting. This example is for demonstration and learning only.
