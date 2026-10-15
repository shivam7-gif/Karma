# Deploying Karma to Render

Karma is fully configured for deployment on Render, supporting either **Static Site (Frontend SPA)** or **Full-Stack (Frontend + Backend API Web Service)** via Render Blueprints.

---

## Method 1: Deploy with Render Blueprint (`render.yaml`) (Recommended)

A root `render.yaml` is provided for one-click setup of both services:

1. Push your repository to GitHub or GitLab.
2. Go to the [Render Dashboard](https://dashboard.render.com/) → **"Blueprints"** → **"New Blueprint Instance"**.
3. Select your repository.
4. Render will automatically read `render.yaml` and configure:
   - **`karma-web`**: Static Site from `frontend/app`, running `npm install && npm run build`, publishing `./dist` with SPA rewrite routes (`/* -> /index.html`).
   - **`karma-api`**: Node Web Service from `backend`, running `npm install && npm run build` and `npm start` with health check endpoint `/health`.
5. Click **"Apply"**.

---

## Method 2: Deploy Frontend Static Site via Render Dashboard

1. Go to [Render Dashboard](https://dashboard.render.com/) → **"New +"** → **"Static Site"**.
2. Connect your repository.
3. Configure settings:
   - **Name**: `karma-web`
   - **Root Directory**: `frontend/app`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Environment Variables:
   - `VITE_USE_MOCK` = `true` (enables mock streaming demo mode)
   - *(Optional)* `VITE_API_ENDPOINT` = `https://your-backend.onrender.com/api/chat`
5. Click **"Create Static Site"**.
   Render automatically respects the included `_redirects` file (`/* /index.html 200`) so client-side navigation (`/login`, `/signup`, `/`) never 404s on reload.
