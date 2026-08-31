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
SUPABASE_SERVICE_ROLE_KEY=sb_secret_LCvW79yXx3Y5pAqWXAnWww_i6t58Sn-
```

Important:
- The publishable key is for browser/mobile use.
- The service role key is for backend use only.
- Never put the service role key in frontend code.
- Never commit `.env` files to Git.

## Team access instructions

1. Clone the repo.
2. Open the project folder. I started this race you're gonna finish what she'll damage the bread she's just a drainer though she's a racer just took me a while to see like me a Queen's team is entered a different cars porting the ninety five probably what I'm seeing on this trackima said normally she did you are table next to ilerve that nothing I asked to be seated here you asked to be seated the shittest table in the restaurant Yeah well I slept the nice hero sheema up there for you like there's been a mistake I didn't mean to leave such a huge dip remember dollar dollar do twenty dollars the tip wasn't my idea my cousin the fuck with garma was sitting with it wasn't me okay can I please sit in my usual place no why this is very unfair they set me up the toilet table leaders of coz I have window table status you what I have window table status I can't be seen associated with a trader you never taught me a window table status I got it. Why not? I signed an NDA. I had to inclus who made me a samurai what I'm a big guy sick it's one fifty per person. Fuck up and drive it's one fifty per person and I didn't sit down and drive fucking business gentlemen everyone on this bus yesterwwer they have to be in for some of us that searched to police resolve thirty issues and go drive the bus, which I understand is just a thing that I will lost a senior driving the bus without everyone having tickets on its not fair. I might not understand this think about it sure you'll come to the right decision if you have ever been
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
