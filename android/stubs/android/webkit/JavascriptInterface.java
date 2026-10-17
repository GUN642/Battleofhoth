package android.webkit;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Nur zum Kompilieren: Die android.jar von Maven Central (API 16) kennt diese
 * Annotation (API 17) noch nicht. Sie landet nicht in classes.dex – zur Laufzeit
 * kommt die echte Klasse aus dem Android-Framework.
 */
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.METHOD})
public @interface JavascriptInterface {
}
