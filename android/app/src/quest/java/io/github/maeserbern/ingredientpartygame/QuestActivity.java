package io.github.maeserbern.ingredientpartygame;

import android.os.SystemClock;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;

/**
 * Meta Quest version of the game screen. Pointing and pinching (or the trigger)
 * already work as taps. This adds the controller buttons and thumbstick so the
 * game can also be played the TV way:
 *   A / X (or a gamepad's A / X / Start) = OK (Enter)
 *   B / Y = Back (Horizon OS sends these as the Android Back button already;
 *           a gamepad's B / Y is handled here the same way)
 *   Thumbstick (scroll events while the ray is on the panel) or a gamepad's
 *           stick / D-pad = arrow keys
 */
public class QuestActivity extends MainActivity {

    private static final long REPEAT_MS = 280;      // held stick repeats this often
    private static final long IDLE_RESET_MS = 350;  // scrolling stopped: start over
    private static final float STICK_ON = 0.6f, STICK_OFF = 0.3f;

    // Thumbstick scroll accumulation.
    private float scrollX, scrollY;
    private long lastScrollEvent, lastScrollMove;
    // Gamepad stick / hat state.
    private int stickDir = 0;
    private long stickLastMove;

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int code = event.getKeyCode();
        switch (code) {
            case KeyEvent.KEYCODE_BUTTON_A:
            case KeyEvent.KEYCODE_BUTTON_X:
            case KeyEvent.KEYCODE_BUTTON_START:
                // Re-send as Enter so the game's OK handling runs.
                if (event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) {
                    sendKey(KeyEvent.KEYCODE_ENTER);
                }
                return true;
            case KeyEvent.KEYCODE_BUTTON_B:
            case KeyEvent.KEYCODE_BUTTON_Y:
                if (event.getAction() == KeyEvent.ACTION_UP) getOnBackPressedDispatcher().onBackPressed();
                return true;
            default:
                return super.dispatchKeyEvent(event);
        }
    }

    @Override
    public boolean dispatchGenericMotionEvent(MotionEvent ev) {
        // Quest thumbstick while the controller ray is over the panel.
        if (ev.getAction() == MotionEvent.ACTION_SCROLL
                && (ev.getSource() & InputDevice.SOURCE_CLASS_POINTER) != 0) {
            long now = SystemClock.uptimeMillis();
            if (now - lastScrollEvent > IDLE_RESET_MS) { scrollX = 0; scrollY = 0; lastScrollMove = 0; }
            lastScrollEvent = now;
            scrollX += ev.getAxisValue(MotionEvent.AXIS_HSCROLL);
            scrollY += ev.getAxisValue(MotionEvent.AXIS_VSCROLL);
            if (Math.abs(scrollX) >= 1f || Math.abs(scrollY) >= 1f) {
                if (now - lastScrollMove >= REPEAT_MS) {
                    if (Math.abs(scrollY) >= Math.abs(scrollX)) {
                        sendKey(scrollY > 0 ? KeyEvent.KEYCODE_DPAD_UP : KeyEvent.KEYCODE_DPAD_DOWN);
                    } else {
                        sendKey(scrollX > 0 ? KeyEvent.KEYCODE_DPAD_RIGHT : KeyEvent.KEYCODE_DPAD_LEFT);
                    }
                    lastScrollMove = now;
                }
                scrollX = 0; scrollY = 0;
            }
            return true;   // the game screen never scrolls
        }

        // Bluetooth gamepad stick or hat (D-pad reported as axes).
        if ((ev.getSource() & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK
                && ev.getAction() == MotionEvent.ACTION_MOVE) {
            float x = ev.getAxisValue(MotionEvent.AXIS_HAT_X);
            float y = ev.getAxisValue(MotionEvent.AXIS_HAT_Y);
            if (Math.abs(x) < STICK_OFF && Math.abs(y) < STICK_OFF) {
                x = ev.getAxisValue(MotionEvent.AXIS_X);
                y = ev.getAxisValue(MotionEvent.AXIS_Y);
            }
            int dir = 0;
            if (Math.abs(x) >= STICK_ON || Math.abs(y) >= STICK_ON) {
                dir = Math.abs(y) >= Math.abs(x)
                        ? (y > 0 ? KeyEvent.KEYCODE_DPAD_DOWN : KeyEvent.KEYCODE_DPAD_UP)
                        : (x > 0 ? KeyEvent.KEYCODE_DPAD_RIGHT : KeyEvent.KEYCODE_DPAD_LEFT);
            } else if (Math.abs(x) >= STICK_OFF || Math.abs(y) >= STICK_OFF) {
                dir = stickDir;   // in between: keep the current direction
            }
            long now = SystemClock.uptimeMillis();
            if (dir != 0 && (dir != stickDir || now - stickLastMove >= REPEAT_MS)) {
                sendKey(dir);
                stickLastMove = now;
            }
            stickDir = dir;
            return true;
        }
        return super.dispatchGenericMotionEvent(ev);
    }

    /** Presses and releases a key on the game page. */
    private void sendKey(int keyCode) {
        if (webView == null) return;
        webView.requestFocus();
        long t = SystemClock.uptimeMillis();
        webView.dispatchKeyEvent(new KeyEvent(t, t, KeyEvent.ACTION_DOWN, keyCode, 0));
        webView.dispatchKeyEvent(new KeyEvent(t, t, KeyEvent.ACTION_UP, keyCode, 0));
    }
}
