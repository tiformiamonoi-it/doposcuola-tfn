# App per telefono (cartella `mobile/`)

Questa cartella contiene il **guscio** dell'app tiformiamonoi.it per Android (più avanti anche iPhone).

Pensala come una **cornice**: dentro non c'è il gestionale, c'è una finestra che apre il sito vero
`https://app.tiformiamonoi.it`. Ogni modifica al sito arriva subito anche nell'app.
L'app va ripubblicata sugli store solo quando cambia la cornice (icona, notifiche, accesso Google).

Il sito e Vercel non vedono questa cartella: la pubblicazione del sito resta identica.

Cosa fa già il guscio:
- apre la pagina di accesso del sito;
- si presenta al sito con la firma `tfn-app`, così il sito sa che è dentro l'app;
- senza internet mostra "Sei offline" con il tasto **Riprova**;
- il tasto "indietro" torna alla pagina precedente; dalla prima pagina esce dall'app;
- WhatsApp, telefono, email e mappe si aprono nelle loro app;
- le barre del telefono (in alto e in basso) sono blu e il sito non ci finisce sotto.

## Prima volta su un PC nuovo

Apri PowerShell e scrivi, una riga alla volta:

```powershell
$env:Path = "E:\tools\node;E:\tools\Git\cmd;" + $env:Path
cd E:\CLAUDE\tiformiamonoi_gestionale\mobile
npm install
```

## (a) Ricostruire l'app di prova (APK "debug")

```powershell
$env:Path = "E:\tools\node;E:\tools\Git\cmd;" + $env:Path
cd E:\CLAUDE\tiformiamonoi_gestionale\mobile
Remove-Item Env:TFN_SERVER_URL -ErrorAction SilentlyContinue
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```

Alla fine deve comparire `BUILD SUCCESSFUL`. Il file dell'app è:
`E:\CLAUDE\tiformiamonoi_gestionale\mobile\android\app\build\outputs\apk\debug\app-debug.apk`

La riga `Remove-Item ...` serve a essere sicuri che l'app apra il sito vero e non un server di prova.

## (b) Installarla sul telefono con il cavo USB

1. Sul telefono: Impostazioni > Info telefono > tocca 7 volte "Numero build" (si attivano le
   "Opzioni sviluppatore"). Poi Impostazioni > Sistema > Opzioni sviluppatore > accendi **Debug USB**.
2. Collega il telefono al PC e, sul telefono, accetta "Consenti debug USB".
3. In PowerShell:

```powershell
E:\tools\android-sdk\platform-tools\adb.exe devices
E:\tools\android-sdk\platform-tools\adb.exe install -r E:\CLAUDE\tiformiamonoi_gestionale\mobile\android\app\build\outputs\apk\debug\app-debug.apk
```

Il primo comando deve mostrare il telefono con la parola `device`. Il secondo deve finire con
`Success`. Il `-r` aggiorna l'app se è già installata, senza perdere l'accesso.

## (c) App che apre il server di prova del PC (TFN_SERVER_URL)

Serve per provare una modifica del sito prima di pubblicarla.

1. In una finestra PowerShell accendi il sito sul PC:

```powershell
$env:Path = "E:\tools\node;E:\tools\Git\cmd;" + $env:Path
cd E:\CLAUDE\tiformiamonoi_gestionale
npm run dev
```

2. In un'altra finestra costruisci l'app che punta al PC:

```powershell
$env:Path = "E:\tools\node;E:\tools\Git\cmd;" + $env:Path
cd E:\CLAUDE\tiformiamonoi_gestionale\mobile
$env:TFN_SERVER_URL = "http://10.0.2.2:3000/login"
npx cap sync android
cd android
.\gradlew.bat assembleDebug
```

`10.0.2.2` è il modo in cui l'**emulatore** Android raggiunge il PC. Per un telefono vero usa
l'indirizzo del PC nella rete di casa, es. `http://192.168.1.20:3000/login` (lo trovi con
`ipconfig`, alla voce "Indirizzo IPv4"), e avvia il sito con `npm run dev -- --host`.

**Importante:** questa app di prova non va mai data a nessuno. Quando hai finito, rifai il punto
(a): toglie l'indirizzo di prova e rimette quello vero.

## Icone e schermata d'avvio

Le immagini di partenza sono in `mobile/assets/` (prese da `public/` del sito). Se le cambi:

```powershell
cd E:\CLAUDE\tiformiamonoi_gestionale\mobile
npm run assets
```

e poi rifai il punto (a).

## Da non fare mai

- Mettere su GitHub una chiave di firma (`*.jks`, `*.keystore`): è già bloccato da `.gitignore`.
- Cambiare la firma `tfn-app` in `capacitor.config.ts` senza cambiare anche il sito.
- Far aprire all'app un indirizzo `*.vercel.app`: deve aprire sempre il nostro dominio.
