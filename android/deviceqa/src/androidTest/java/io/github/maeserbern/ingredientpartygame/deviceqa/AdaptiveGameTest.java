package io.github.maeserbern.ingredientpartygame.deviceqa;

import android.content.Intent;
import android.util.Base64;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.By;
import androidx.test.uiautomator.UiDevice;
import androidx.test.uiautomator.UiObject2;
import androidx.test.uiautomator.Until;
import java.io.ByteArrayOutputStream;
import java.util.regex.Pattern;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class AdaptiveGameTest {
    private static final String GAME = "io.github.maeserbern.ingredientpartygame";
    private UiDevice device;
    private static final String EVIDENCE = "/sdcard/Download/ingredient-device-qa";

    private void resumeGame() {
        Intent intent = new Intent(Intent.ACTION_MAIN)
                .setClassName(GAME, GAME + ".MainActivity")
                .addCategory(Intent.CATEGORY_LAUNCHER)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        InstrumentationRegistry.getInstrumentation().getContext().startActivity(intent);
    }

    @Before public void launch() throws Exception {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        device.executeShellCommand("mkdir -p " + EVIDENCE);
        device.executeShellCommand("am force-stop " + GAME);
        device.setOrientationNatural();
        resumeGame();
        expect("^Play$");
    }

    @After public void cleanup() throws Exception {
        shot("final-state");
        ByteArrayOutputStream hierarchy = new ByteArrayOutputStream();
        device.dumpWindowHierarchy(hierarchy);
        String encoded = Base64.encodeToString(hierarchy.toByteArray(), Base64.NO_WRAP);
        device.executeShellCommand("printf %s " + encoded + " | base64 -d > " + EVIDENCE + "/window-hierarchy.xml");
        device.executeShellCommand("wm size reset");
        device.unfreezeRotation();
    }

    private UiObject2 expect(String regex) {
        Pattern pattern = Pattern.compile(regex, Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
        UiObject2 element = device.wait(Until.findObject(By.text(pattern)), 15000);
        if (element == null) element = device.wait(Until.findObject(By.desc(pattern)), 5000);
        assertNotNull("Missing visible game content: " + regex, element);
        assertFalse("Empty bounds: " + regex, element.getVisibleBounds().isEmpty());
        return element;
    }

    private void shot(String name) throws Exception {
        device.waitForIdle();
        String path = EVIDENCE + "/" + name + ".png";
        device.executeShellCommand("screencap -p " + path);
        assertTrue("Screenshot not captured", device.executeShellCommand("test -s " + path + " && echo OK").contains("OK"));
    }

    @Test public void rotationResizeAndBackgroundKeepGame() throws Exception {
        shot("01-title");
        expect("^Play$").click();
        expect("^Pick your book$");
        shot("02-books");
        device.setOrientationLeft();
        expect("^Pick your book$");
        shot("03-books-rotated");
        device.setOrientationNatural();
        expect("^Pick your book$");
        device.executeShellCommand("wm size 1840x2208");
        expect("^Pick your book$");
        shot("04-books-large-window");
        device.executeShellCommand("wm size reset");
        expect("^Pick your book$");
        device.pressHome();
        resumeGame();
        expect("^Pick your book$");
        expect(".*It.s Not Food.*").click();
        expect("^Game setup$");
        expect("^Solo$").click();
        expect("^Start game$").click();
        expect("^Next ingredient$");
        shot("05-round");
        expect("^Menu$").click();
        expect("^Game paused$");
        expect("^Resume game$").click();
        expect("^Next ingredient$");
    }
}
