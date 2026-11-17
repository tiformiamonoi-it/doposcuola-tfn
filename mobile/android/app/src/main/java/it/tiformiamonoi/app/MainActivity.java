package it.tiformiamonoi.app;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Tasto "indietro" di Android: torna alla pagina precedente del sito; dalla prima
        // pagina esce dall'app come fa ogni app. Lo scriviamo qui perché il plugin
        // @capacitor/app, senza codice nel sito, torna indietro ma dalla prima pagina
        // non fa nulla (l'app non si chiude mai).
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                // Dalla pagina "Sei offline" non si torna indietro: si ricaricherebbe la
                // pagina fallita, che riporta qui, e l'app non si chiuderebbe più.
                boolean paginaOffline = webView != null && String.valueOf(webView.getUrl()).equals(getBridge().getErrorUrl());
                if (webView != null && webView.canGoBack() && !paginaOffline) {
                    webView.goBack();
                    return;
                }
                // Comportamento normale di Android (esce dall'app)
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }
}
