# Llama Trauma

A kid-friendly hopping game for Brianna. Help a color-customizable llama hop across grass, roads, rivers, and train tracks. Tap to hop forward; swipe left, right, or back to move those ways.

This is an original game (code, art, and sounds). It is a web app you can add to an iPhone Home Screen.

## Play on iPhone (Safari)

The game needs to be opened over **HTTPS** (or on the iPhone itself via a local trusted page). In Safari:

1. Open the game’s URL.
2. Tap the **Share** button.
3. Tap **Add to Home Screen**.
4. Tap **Add**.

The app opens full screen with its own llama icon, and after the first visit it works **offline**.

The first time you open the file, iOS may ask you to tap once so sounds can play. Use the speaker button to mute, including the silly game-over toot.

## Controls

- **Tap** — hop forward
- **Swipe left / right / back** — hop that way
- Collect coins, beat your best distance, and dress your llama in **Dress Up**
- Every body and blanket color is free. A few hats can be unlocked with coins

## If you see “Oops!”

Getting bumped by a car, truck, or train plays a cartoon toot and drops a silly poop pile with stink lines. Falling in the river makes a splash (and a bubbly underwater toot). If you stand still too long, a friendly cloud named Nimbus scoops the llama up.

## Hosting

This folder is a static website (`index.html`, `css/`, `js/`, `icons/`, `manifest.webmanifest`, `sw.js`). Put the whole folder on any static HTTPS host (GitHub Pages, Netlify, Cloudflare Pages, a home server, etc.). Do not open it as a `file://` page if you want Add to Home Screen and offline mode to work.

## Privacy

No ads, no accounts, no tracking, and no network calls after the files are loaded. Scores, coins, mute, and llama colors are saved only in the phone’s `localStorage`.
