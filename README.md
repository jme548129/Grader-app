# Grader – checker ng answer sheet

## 1. Gumawa ng backend (Supabase, libre)
1. Mag-sign up sa https://supabase.com at gumawa ng bagong project.
2. Buksan ang **SQL Editor**, i-paste ang laman ng `supabase.sql`, at i-**Run**.
3. Pumunta sa **Project Settings > API**. Kopyahin ang **Project URL** at ang **anon public key**, at ilagay sa `config.js`.
   (Ligtas na pampubliko ang anon key. Ang proteksyon ay galing sa mga RLS policy sa SQL.)
4. Opsyonal: sa **Authentication > Providers > Email**, i-off ang "Confirm email" kung gusto mong makapasok agad ang mga bagong user.

## 2. I-upload sa GitHub
1. Gumawa ng bagong repository.
2. I-upload ang `index.html`, `config.js`, `cloud.js`, `admin.html` (at `supabase.sql`, `README.md`).
3. **Settings > Pages > Source: Deploy from a branch > main / (root) > Save**.
4. Sa ilang minuto, bubuksan mo ang app sa `https://USERNAME.github.io/REPO/`.
   Gumagana ang camera dahil HTTPS ang GitHub Pages. Payagan ang Camera kapag tinanong.

## 3. Maging admin
1. Buksan ang app, mag-sign up gamit ang email mo.
2. Sa Supabase SQL Editor, i-run (palitan ang email):
   `insert into admins select id from auth.users where email='iyong-email@example.com';`
3. Buksan ang `.../admin.html` para makita kung sino ang gumagamit, ilang papel ang na-save nila, at ang mga resulta.

Kung hindi mo pa nilalagay ang config, gumagana ang app nang walang login at walang backend.
