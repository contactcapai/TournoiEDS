// Client CDP minimal — ZÉRO DÉPENDANCE (Node 22 expose `WebSocket` nativement).
//
// Ni puppeteer ni playwright, et c'est délibéré : cet outillage sert de PORTE, donc
// il doit rester exécutable sans installation et sans peser sur le lockfile du
// monorepo. Il pilote le Chrome déjà présent sur la machine.
//
// Chemin de Chrome : surchargeable par la variable d'environnement CHROME_PATH.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CANDIDATS = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

const CHROME = CANDIDATS.find((p) => existsSync(p));
if (!CHROME) {
  throw new Error(
    "Chrome introuvable. Chemins testés :\n  " +
      CANDIDATS.join("\n  ") +
      "\nDéfinir CHROME_PATH pour pointer un binaire Chrome/Chromium.",
  );
}

export async function launchChrome(port = 9222) {
  const profile = mkdtempSync(join(tmpdir(), "eds-cdp-"));
  const proc = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--hide-scrollbars", // sinon la scrollbar fausse clientWidth
      "--force-device-scale-factor=1",
      "about:blank",
    ],
    { stdio: "ignore", detached: false },
  );

  // Attendre que l'endpoint réponde — on lit un TÉMOIN réel (la réponse HTTP du
  // débogueur), pas un simple délai (pieges/faux-succes.md).
  let version = null;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) {
        version = await r.json();
        break;
      }
    } catch {
      /* pas encore prêt */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!version) throw new Error("Chrome n'a pas ouvert son endpoint CDP");

  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res, { once: true });
    ws.addEventListener("error", rej, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  const listeners = [];

  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) {
        reject(new Error(JSON.stringify(msg.error)));
      } else {
        resolve(msg.result);
      }
    } else if (msg.method) {
      for (const l of listeners) l(msg);
    }
  });

  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });

  const once = (method, sessionId) =>
    new Promise((resolve) => {
      const l = (msg) => {
        if (msg.method === method && (!sessionId || msg.sessionId === sessionId)) {
          listeners.splice(listeners.indexOf(l), 1);
          resolve(msg.params);
        }
      };
      listeners.push(l);
    });

  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);

  return {
    // Émule une media feature (ex. prefers-reduced-motion: reduce).
    async setEmulatedMedia(features) {
      await send(
        "Emulation.setEmulatedMedia",
        { features: Object.entries(features).map(([name, value]) => ({ name, value })) },
        sessionId,
      );
    },
    async setViewport(width, height = 900) {
      await send(
        "Emulation.setDeviceMetricsOverride",
        { width, height, deviceScaleFactor: 1, mobile: false },
        sessionId,
      );
    },
    async goto(url) {
      const loaded = once("Page.loadEventFired", sessionId);
      await send("Page.navigate", { url }, sessionId);
      await loaded;
      // Laisser la mise en page se stabiliser (polices next/font, images).
      await this.eval(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`, true);
      await this.eval(`document.fonts.ready.then(() => true)`, true);
    },
    async eval(expression, awaitPromise = false) {
      const r = await send(
        "Runtime.evaluate",
        { expression, returnByValue: true, awaitPromise },
        sessionId,
      );
      if (r.exceptionDetails) {
        throw new Error(
          "Erreur dans la page : " +
            (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text),
        );
      }
      return r.result.value;
    },
    // Capture PLEINE PAGE : `captureBeyondViewport` évite d'avoir à scroller
    // (le scroll déclencherait les animations liées au défilement).
    async captureFullPage() {
      const { cssContentSize } = await send("Page.getLayoutMetrics", {}, sessionId);
      const { data } = await send(
        "Page.captureScreenshot",
        {
          format: "png",
          captureBeyondViewport: true,
          clip: {
            x: 0,
            y: 0,
            width: cssContentSize.width,
            height: cssContentSize.height,
            scale: 1,
          },
        },
        sessionId,
      );
      return data;
    },
    // Fermeture best-effort : les trois étapes sont indépendantes et une seule
    // doit pouvoir échouer sans empêcher les suivantes — sinon un profil
    // temporaire reste sur le disque à chaque exécution. Les erreurs sont donc
    // avalées DÉLIBÉRÉMENT, et c'est le seul endroit du dossier où c'est le cas.
    async close() {
      try {
        ws.close();
      } catch {
        // socket déjà fermée par le navigateur : rien à faire
      }
      try {
        proc.kill();
      } catch {
        // processus déjà sorti : rien à faire
      }
      try {
        rmSync(profile, { recursive: true, force: true });
      } catch {
        // profil verrouillé par Windows le temps que Chrome rende la main :
        // il sera purgé avec le dossier temporaire du système
      }
    },
  };
}
