# MindPulse Connection Guide

This file is for the shared project connection details so teammates can connect to the same Supabase project quickly and safely.

## Shared Supabase project

Project URL:
https://whihfwcygbqpjtrpnlck.supabase.co

Project ID:
whihfwcygbqpjtrpnlck

Region:
ap-northeast-2

## Frontend web app

Create a local file named `.env` in the `mindpulse-web` folder:

```env
REACT_APP_SUPABASE_URL=https://whihfwcygbqpjtrpnlck.supabase.co
REACT_APP_SUPABASE_PUBLISHABLE_KEY=sb_publishable_WwxgnGMnrVQ-J2Ud6K-r8g_EJy9OSBP
```

## Mobile app

The mobile app uses the same project in `mindpulse-mobile/src/supabase/config.ts`:

```ts
export const supabaseConfig = {
  url: 'https://whihfwcygbqpjtrpnlck.supabase.co',
  publishableKey: 'sb_publishable_WwxgnGMnrVQ-J2Ud6K-r8g_EJy9OSBP',
};
```

## Backend

Create a local file named `.env` in the `mindpulse-backend` folder:

```env
SUPABASE_URL=https://whihfwcygbqpjtrpnlck.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_KEY>
```

Important:
- The publishable key is for browser/mobile use.
- The service role key is for backend use only.
- Never put the service role key in frontend code.
- Never commit `.env` files to Git.

## Team access instructions

1. Clone the repo.
2. Open the project folder and make sure the repo is checked out on the same branch.
3. Create the local `.env` files in `mindpulse-web` and `mindpulse-backend`.
4. Make sure they have access to the same Supabase project in the Supabase dashboard.
5. Run the app from the correct folder:

### Web
```bash
cd mindpulse-web
npm install
npm start
```

### Mobile
```bash
cd mindpulse-mobile
npm install
npm run web
```

### Backend
```bash
cd mindpulse-backend
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt
python manage.py runserver
```

## Security reminder

Keep these rules in mind:
- `.env` files stay local
- secret keys stay on the backend only
- publishable keys are shared with browser/mobile clients
- the repo should not contain real secrets

## Questions

If someone cannot connect, check:
- the correct `.env` file exists in the right folder
- the project URL is correct
- the Supabase project is shared with their account
- the required frontend/backend dependency installs were completed
