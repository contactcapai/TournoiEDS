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
    /**
     * Coupe l'exécution de TOUT script dans la page (Story 4.1).
     *
     * 🔴 À APPELER AVANT `goto`, sinon le document est déjà hydraté quand la bascule
     * prend effet et la mesure ne dit plus rien de l'état servi.
     *
     * Sert à prouver une propriété qu'aucune autre porte ne peut voir : que le HTML
     * SERVI est utilisable seul. Le bandeau de logos en dépend (WCAG 2.2.2 — un
     * défilement sans commande de pause serait non conforme, et la commande a besoin
     * de JavaScript ; l'animation ne doit donc pas démarrer sans lui).
     * ⚠️ `Emulation.setScriptExecutionDisabled` est un réglage de SESSION : il reste
     * actif jusqu'à ce qu'on le remette à `false`. Ne pas l'oublier entre deux mesures.
     */
    async setScriptExecutionDisabled(value) {
      await send("Emulation.setScriptExecutionDisabled", { value }, sessionId);
    },
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
    /**
     * @param {string} url
     * @param {{ sansScripts?: boolean }} [options] — mettre `sansScripts: true` quand
     *   `setScriptExecutionDisabled(true)` est actif.
     *
     * 🔴 POURQUOI CETTE OPTION EXISTE (mesuré en Story 4.1) : les deux `eval` de
     * stabilisation ci-dessous attendent une PROMESSE DE LA PAGE. Scripts coupés, cette
     * promesse ne se résout jamais et CDP finit par rejeter
     * « Promise was collected » — la porte tombe sur une erreur technique au lieu de
     * mesurer. Le défaut a été trouvé par l'auto-validation de `gate:marquee`, pas par
     * un raisonnement : c'est exactement ce à quoi sert de faire échouer une porte
     * exprès avant de s'y fier (`pieges/instrument-non-valide.md`).
     */
    async goto(url, { sansScripts = false } = {}) {
      const loaded = once("Page.loadEventFired", sessionId);
      await send("Page.navigate", { url }, sessionId);
      await loaded;
      if (sansScripts) {
        // Aucun témoin lisible dans la page : on laisse la mise en page se poser par
        // une attente côté Node. ⚠️ C'est le SEUL endroit de ce dossier où l'on se fie
        // à un délai plutôt qu'à un témoin, et c'est parce qu'il n'y en a aucun de
        // disponible — pas par commodité.
        await new Promise((r) => setTimeout(r, 500));
        return;
      }
      // Laisser la mise en page se stabiliser (polices next/font, images).
      await this.eval(`new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`, true);
      await this.eval(`document.fonts.ready.then(() => true)`, true);
    },
    /**
     * Envoie une VRAIE frappe clavier par la pile d'entrée de Chrome (Story 4.3).
     *
     * 🔴 POURQUOI PAS `dispatchEvent(new KeyboardEvent('keydown', …))` : un événement
     * fabriqué en JS est `isTrusted: false`. Le navigateur exécute bien les gestionnaires
     * qui l'écoutent, mais il **ne fait pas l'action par défaut** — un Tab fabriqué ne
     * DÉPLACE PAS le focus. Une porte qui mesurerait un piège de focus avec de tels
     * événements verrait le focus immobile et conclurait « piégé » quoi qu'il arrive :
     * elle serait verte sur un composant sans aucun piège.
     * `Input.dispatchKeyEvent` passe par la pile d'entrée réelle, donc le focus bouge
     * vraiment et la mesure dit quelque chose.
     *
     * 🔴 `rawKeyDown` NE SUFFIT PAS POUR ENTRÉE, ET C'EST MESURÉ, PAS SUPPOSÉ.
     * Diagnostic fait pendant la Story 4.3, sur un `<button>` focalisé :
     *     `.click()` programmatique ......... ouvre ✅
     *     `rawKeyDown` Espace ............... ouvre ✅   (l'activation se fait au keyUp)
     *     `rawKeyDown` Entrée ............... N'OUVRE PAS ❌
     * Chrome ne déclenche l'action par défaut d'Entrée que sur un `keyDown` porteur de
     * `text` (`"\r"`). Sans cette distinction, une porte conclurait que le composant ne
     * répond pas au clavier alors que c'est l'INSTRUMENT qui ne frappe pas vraiment —
     * exactement l'inverse du diagnostic, et un défaut inventé de toutes pièces.
     * ⚠️ Ne pas « simplifier » en mettant `keyDown` partout : `keyDown` sans `text` sur
     * Tab ou Échap n'est pas la forme attendue par CDP.
     *
     * @param {{ key: string, code: string, windowsVirtualKeyCode: number, modifiers?: number, text?: string }} touche
     *   `modifiers` : masque CDP — 1 Alt, 2 Ctrl, 4 Meta, **8 Maj**.
     *   `text` : à fournir pour les touches dont on attend l'ACTION PAR DÉFAUT (Entrée).
     */
    async envoyerTouche({ key, code, windowsVirtualKeyCode, modifiers = 0, text }) {
      const commun = { key, code, windowsVirtualKeyCode, nativeVirtualKeyCode: windowsVirtualKeyCode, modifiers };
      await send(
        "Input.dispatchKeyEvent",
        text === undefined
          ? { type: "rawKeyDown", ...commun }
          : { type: "keyDown", text, unmodifiedText: text, ...commun },
        sessionId,
      );
      await send("Input.dispatchKeyEvent", { type: "keyUp", ...commun }, sessionId);
      // Laisse React re-rendre avant que l'appelant ne relève l'état. Sans cette
      // respiration, un relevé immédiat lirait l'état d'AVANT la frappe et la porte
      // mesurerait systématiquement un cran en retard.
      await new Promise((r) => setTimeout(r, 60));
    },
    /**
     * Déplace VRAIMENT le pointeur (Story 5.5).
     *
     * 🔴 Même motif que `envoyerTouche` : un `dispatchEvent(new MouseEvent('mouseover'))`
     * est `isTrusted: false`. Les gestionnaires JS s'exécutent, mais l'état `:hover` du
     * moteur de rendu **ne bascule pas** — une porte qui mesurerait une affordance de
     * survol avec un événement fabriqué lirait le style de repos et conclurait
     * « aucun survol » quoi qu'il arrive. Elle serait verte sur un élément inerte qui
     * s'illumine à la souris, c'est-à-dire sur le défaut exact qu'elle surveille.
     *
     * Les coordonnées sont en pixels CSS, relatives au VIEWPORT (pas au document) :
     * l'appelant fait défiler jusqu'à l'élément avant d'appeler.
     */
    async bougerSouris(x, y) {
      await send(
        "Input.dispatchMouseEvent",
        { type: "mouseMoved", x, y, button: "none", buttons: 0 },
        sessionId,
      );
      // Laisse la transition CSS (0,2s sur `.link`/`.social`) se poser avant relevé.
      await new Promise((r) => setTimeout(r, 300));
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
