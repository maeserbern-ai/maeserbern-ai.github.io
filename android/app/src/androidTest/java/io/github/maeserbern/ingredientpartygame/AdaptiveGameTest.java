package io.github.maeserbern.ingredientpartygame;

import android.content.pm.ActivityInfo;
import androidx.lifecycle.Lifecycle;
import androidx.test.ext.junit.rules.ActivityScenarioRule;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.espresso.web.webdriver.Locator;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

import static androidx.test.espresso.web.sugar.Web.onWebView;
import static androidx.test.espresso.web.assertion.WebViewAssertions.webMatches;
import static androidx.test.espresso.web.webdriver.DriverAtoms.findElement;
import static androidx.test.espresso.web.webdriver.DriverAtoms.getText;
import static androidx.test.espresso.web.webdriver.DriverAtoms.webClick;
import static org.hamcrest.Matchers.containsString;

@RunWith(AndroidJUnit4.class)
public class AdaptiveGameTest {
    @Rule public ActivityScenarioRule<MainActivity> activity = new ActivityScenarioRule<>(MainActivity.class);

    private void click(String selector) {
        onWebView().withElement(findElement(Locator.CSS_SELECTOR, selector)).perform(webClick());
    }
    private void visibleScreen(String text) {
        onWebView().withElement(findElement(Locator.CSS_SELECTOR, ".screen.active"))
                .check(webMatches(getText(), containsString(text)));
    }

    @Test public void rotationAndBackgroundKeepSelection() {
        onWebView().forceJavascriptEnabled();
        visibleScreen("Play");
        click("#s-title [data-action='books']");
        visibleScreen("Pick your book");
        activity.getScenario().onActivity(a -> a.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE));
        visibleScreen("Pick your book");
        activity.getScenario().onActivity(a -> a.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT));
        visibleScreen("Pick your book");
        activity.getScenario().moveToState(Lifecycle.State.CREATED);
        activity.getScenario().moveToState(Lifecycle.State.RESUMED);
        visibleScreen("Pick your book");
        click("[data-book='food']");
        visibleScreen("Game setup");
    }
}
