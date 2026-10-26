# TicTacToe Arena: online multiplayer (Supabase edition)

Real-time two-player Tic-Tac-Toe with a black and neon design. The website is plain HTML/CSS/JavaScript hosted on
**GitHub Pages** (no build step, no npm). The live part is **Supabase**: anonymous sign-in, a Postgres database with
**Row Level Security (RLS)**, and **Realtime**.

> GitHub Pages only serves the files. Until you finish the Supabase steps below, the page shows a "not set up"
> banner and Create/Join stay disabled. Online play does not work before then.

## What has and has not been tested

| Part | Status |
|---|---|
| `app.js` and `supabase-config.js` JavaScript syntax | Checked with Node. |
| Client logic (sign-in, create, join, moves, win display, rematch, opponent offline, leave, error messages) | Smoke-tested in Node against a **fake in-memory Supabase client** that imitates the SQL rules. This proves the page code runs; it does **not** prove Supabase behaves the same. |
| Secret-key guard in `supabase-config.js` | Tested in Node. |
| `supabase-setup.sql` | **NOT tested.** Written carefully and checked for balanced quotes and brackets only. No Postgres was available to run it. |
| `supabase-tests.sql` | **NOT run.** You run it in step 5. |
| Realtime delivery (live board updates, Presence, the private-channel policies) | **NOT tested.** Needs a real project and two browsers (step 8). |
| Loading the Supabase library from the CDN, the GitHub Pages deployment, and the visual layout on real phones/Chromebooks | **NOT tested.** |

Do steps 5 and 8 before you trust it, and tell me about any failure.

## Online Ludo added

The TicTacToe lobby now links to `ludo.html`. Ludo uses the same Supabase project but has its own `ludo_rooms` table. **One-time setup required:** open Supabase Dashboard → SQL Editor, paste the complete contents of `ludo-setup.sql`, and click Run. Then open `https://YOUR-USERNAME.github.io/tictactoe/ludo.html` (replace the username/repository if yours differs), create a room, and share the code with friends. The room state syncs through Supabase Realtime. This Ludo version is an early playable implementation; the state-write RPC checks room membership but is not a competitive anti-cheat engine, so don't use it for prizes or ranked play.

## Files

| File | What it is |
|---|---|
| `index.html` | The page (lobby and game screens) |
| `style.css` | The black and neon design |
| `app.js` | Game screen logic and Supabase client code |
| `supabase-config.js` | **You edit this**: paste your Supabase URL and publishable key |
| `supabase-setup.sql` | **You run this once** in the Supabase SQL Editor: table, RLS, game rules, Realtime policies |
| `supabase-tests.sql` | **You run this once** to check security and game rules (optional but strongly recommended) |
| `README.md` | This guide |

## How it works and why it is secure

- Each browser signs in **anonymously**, which gives it a private user id. No accounts or emails.
- The browser can only **read** rooms it plays in (RLS policy). A stranger cannot list rooms or peek at a room.
- The browser can **not insert, update or delete** anything directly. Those privileges are revoked and no write policies exist.
- All changes go through five database functions that run on the server and check who is calling:
  `create_room`, `join_room`, `make_move`, `request_rematch`, `leave_room`. They verify the player, whose turn it is,
  that the cell is empty, and that the round is not over. They also work out the win or draw and update the score themselves,
  so the website cannot fake a result. A rematch resets the board on the server only after **both** players ask.
- "Is my opponent online?" uses Realtime **Presence** on a **private** channel. Policies on `realtime.messages`
  allow only the two players of a room to join its channel, and only for presence.
- The website contains only the project URL and the **publishable** key. These are meant to be public. Do not ever
  put a **secret** or **service_role** key in these files; `app.js` refuses to start if it detects one.

---

## Step 1. Create a Supabase project

1. Go to <https://supabase.com>, sign in, and click **New project**.
2. Choose a name, a strong database password (save it somewhere safe; you won't need it for this game), and the region closest to you and your friends.
3. Wait for the project to finish setting up.

## Step 2. Turn on anonymous sign-ins

1. Open **Authentication** and find **Sign In / Providers** (the exact menu wording changes sometimes).
2. Turn on **Allow anonymous sign-ins** and save.

## Step 3. Run the setup SQL

1. Open **SQL Editor** and click **New query**.
2. Paste the **entire** contents of `supabase-setup.sql` and click **Run**.
3. It should finish without errors. It is safe to run again.

## Step 4. Paste your URL and key into `supabase-config.js`

1. Open **Project Settings** and find **API Keys** (or **API**).
2. Copy the **Project URL** (looks like `https://abcdefgh.supabase.co`) and the **publishable** key (`sb_publishable_...`;
   an older project may show an **anon** key instead, which also works).
3. Open `supabase-config.js` and replace the two `PASTE_...` values.

Never copy the **secret** key or the **service_role** key.

## Step 5. Run the test script (strongly recommended)

1. In the SQL Editor, open a new query, paste the entire contents of `supabase-tests.sql`, and click **Run**.
2. You get a table of results. **Every row must show `passed = true`**, and the last row is a SUMMARY.
3. The script pretends to be several players and a stranger, tries legal moves and cheating attempts, and then **rolls everything back**,
   so it leaves no data behind and never touches real users.
4. If any row is `false` (or an "UNEXPECTED ERROR" row appears), copy the `test` and `detail` columns and send them to me. Do not play until it is fixed.

## Step 6. (Optional) try it on your own computer

Browsers block `import` from `file://`, so do not double-click `index.html`. Either skip to step 7, or run a small local
server in this folder (needs Python): `python3 -m http.server 8000`, then open <http://localhost:8000>.

## Step 7. Publish on GitHub Pages (no build command)

1. Create a GitHub repository (public, for example `tictactoe-arena`).
2. Click **Add file > Upload files** and upload `index.html`, `style.css`, `app.js` and `supabase-config.js`
   (the other files are optional). Click **Commit changes**.
3. Open **Settings > Pages**. Under **Build and deployment**, set **Source: Deploy from a branch**,
   **Branch: main**, folder **/ (root)**, and **Save**.
4. After a minute or two your site is live at `https://YOUR-USERNAME.github.io/tictactoe-arena/`.

Nothing is compiled. The Supabase library is loaded from the jsDelivr CDN at a fixed version (`2.110.1`) set at the top of `app.js`.
Supabase accepts requests from any website by default, so there is no domain list to configure.

## Step 8. Test with two different browsers

Each browser profile is a separate player. **Two tabs in the same browser are the same player**, so they cannot be opponents.

1. Browser A (for example Chrome): open the site and click **Create room**. Note the code.
2. Browser B (Firefox, Edge, a Chrome Incognito window, or your phone): open the site, enter the code, click **Join room**.
3. Both screens should say **Connected**. Check that:
   - only the player whose turn it is can click, and occupied squares cannot be clicked;
   - moves, scores and results appear on both screens within a moment;
   - closing one browser's tab shows **Opponent disconnected** on the other, and reopening the site rejoins automatically;
   - after a round, pressing **Rematch** on both sides resets the board and the other player starts;
   - **Leave room** as the guest returns the host to "Waiting for opponent"; as the host it closes the room for both.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Yellow "not set up" banner | `supabase-config.js` still has `PASTE_...` values. |
| "Unsafe key" / message about a SECRET key | You pasted the wrong key. Use the publishable (or anon) key only. If a secret key was ever uploaded to GitHub, rotate it in Supabase. |
| "Sign-in failed ... Allow anonymous sign-ins" | Step 2. |
| "The game database isn't set up yet" | Step 3: run `supabase-setup.sql`. |
| "The database refused the request (permissions)" | Re-run `supabase-setup.sql` (it resets the privileges). |
| Board does not update live for the other player | In the SQL Editor run `select * from pg_publication_tables where pubname = 'supabase_realtime';` and check that `rooms` is listed. If not, re-run `supabase-setup.sql`. The page also re-checks the room every 20 seconds as a fallback. |
| Never shows "Opponent disconnected", or always shows it | Presence uses private-channel policies on `realtime.messages`. Re-run `supabase-setup.sql` and check the browser console (F12) for a "Presence channel error". The game still works without presence. |
| "Room not found" | Wrong code, or the host already left (leaving closes the room). Codes never contain `I`, `O`, `0` or `1`. |
| First load after a quiet week is slow or fails | Free Supabase projects can **pause** after a period of inactivity. Open the dashboard and restore the project. Check Supabase's current free-plan rules. |

## Good to know

- **Cleanup:** rooms idle for 12 hours are deleted automatically whenever anyone creates a room. An optional scheduled job is described at the bottom of `supabase-setup.sql`.
- **Limits:** a player can host at most 3 active rooms at a time.
- **Abuse protection:** anonymous accounts are easy to create. CAPTCHA is deliberately **not** enabled in this version. If strangers start abusing the game, turn it on in Supabase Authentication settings (it also requires adding the CAPTCHA widget to the page).
- **Room codes** have 6 characters from a 32-character alphabet (about a billion combinations) and are generated on the server.
- If a player closes the tab mid-game, their seat is kept. They rejoin from the same browser and the page resumes automatically.
- The Supabase library version is pinned in `app.js`. You can raise it later after checking that the game still works.
