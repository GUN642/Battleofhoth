import com.android.apksig.ApkSigner;
import com.android.apksig.ApkVerifier;

import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;

/**
 * Signiert bzw. prüft eine APK mit der apksig-Bibliothek (APK Signature Scheme v2, minSdk 24).
 * v1 (JAR-Signatur) ist abgeschaltet, weil apksig 2.3.0 dafür entfernte JDK-Interna braucht.
 *   java Sign sign <keystore.p12> <passwort> <alias> <minSdk> <in.apk> <out.apk>
 *   java Sign verify <apk>
 */
public class Sign {
    public static void main(String[] a) throws Exception {
        if (a[0].equals("sign")) {
            char[] pw = a[2].toCharArray();
            KeyStore ks = KeyStore.getInstance("PKCS12");
            try (FileInputStream in = new FileInputStream(a[1])) { ks.load(in, pw); }
            PrivateKey key = (PrivateKey) ks.getKey(a[3], pw);
            X509Certificate cert = (X509Certificate) ks.getCertificate(a[3]);
            ApkSigner.SignerConfig cfg = new ApkSigner.SignerConfig.Builder("HOTH", key, Collections.singletonList(cert)).build();
            new ApkSigner.Builder(Collections.singletonList(cfg))
                    .setInputApk(new File(a[5]))
                    .setOutputApk(new File(a[6]))
                    .setMinSdkVersion(Integer.parseInt(a[4]))
                    .setV1SigningEnabled(false)
                    .setV2SigningEnabled(true)
                    .build()
                    .sign();
            System.out.println("signiert: " + a[6]);
        } else {
            ApkVerifier.Result r = new ApkVerifier.Builder(new File(a[1])).build().verify();
            System.out.println("verified=" + r.isVerified() + " v1=" + r.isVerifiedUsingV1Scheme() + " v2=" + r.isVerifiedUsingV2Scheme());
            for (Object e : r.getErrors()) System.out.println("FEHLER: " + e);
            for (Object w : r.getWarnings()) System.out.println("Warnung: " + w);
            if (!r.isVerified()) System.exit(1);
        }
    }
}
