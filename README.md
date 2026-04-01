# LED Controller App

Browser-based control app for a 50-pixel WS2811 string driven by Python on a Raspberry Pi.

## What this version includes

- 50-light ordered side panel
- Background image upload
- Edit mode for placement, naming, and keyboard mapping
- Live click and key control
- JSON-backed layout persistence
- Recording with backend timestamps
- Saved recording library
- Playback with loop support
- Mock LED driver for non-Pi development

## Project layout

```text
app/
  main.py
  service.py
  storage.py
  led_driver.py
  defaults.py
static/
  index.html
  styles.css
  app.js
data/
  uploads/
  recordings/
```

## Local development

1. Create and activate a virtual environment.
2. Install the app requirements:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

3. Start the server:

```powershell
python -m app.main
```

4. Open [http://localhost:8000](http://localhost:8000)

## How to use the app

This app has two main use cases:

- Build and test the UI on a normal computer with the mock driver
- Run the same app on a Raspberry Pi with a real WS2811 string attached

If you are testing on a laptop or desktop first, that is fine. The app will still show on-screen light feedback even when no controller is connected.

### First launch

1. Start the server.
2. Open the app in your browser at `http://localhost:8000`
3. Confirm the driver status in the top-right corner:
   - `Mock driver` means UI-only testing
   - `Real driver` means the Pi LED library loaded successfully

### Basic workflow

1. Click `Edit`
2. Upload a background image if you want a scene reference
3. Drag lights from the left panel onto the scene canvas
4. Give lights display names if needed
5. Assign keyboard keys if needed
6. Click `Save Layout` or `Done`
7. Use `Live mode` to click lights on screen or trigger them with the keyboard

### Live mode

In live mode you can:

- Click a light in the side panel to toggle it
- Click a placed light on the scene to toggle it
- Press a mapped keyboard key to toggle its assigned light
- Use `All Off` to clear every active light

### Edit mode

In edit mode you can:

- Drag unplaced lights from the left panel onto the scene
- Drag placed lights to reposition them
- Rename lights without changing their physical LED number
- Assign a single keyboard key to a light
- Remove a placed light from the scene
- Upload or replace the scene image

Your wiring order does not change. Physical LED `1-50` always stays the same in the backend.

### Recording

To record a sequence:

1. Make sure you are not in edit mode
2. Click `Record`
3. Trigger lights by mouse or keyboard
4. Click `Stop`
5. Enter a recording name
6. Optionally enable `Save loop pref`
7. Click `Save Recording`

### Playback

To play a recording:

1. Open the playback dropdown
2. Pick a saved recording or built-in preset
3. Enable `Loop` if you want it to repeat
4. Click `Play`
5. Click `Stop` to end playback

### Built-in presets

The app includes two built-in presets:

- `Wave`: turns lights on and off in order from `1` to `50` over `5` seconds
- `Random`: flashes random lights for `5` seconds

These behave like recordings during playback, but they are built into the app and cannot be deleted.

### Saved files

The app stores its data locally in the `data/` folder:

- `data/layout.json`: light names, positions, keys, and background image reference
- `data/settings.json`: app and driver settings
- `data/recordings/*.json`: saved recordings
- `data/uploads/`: uploaded scene images

### If the browser looks out of date

If you changed code and the UI still looks old, do a hard refresh:

- Windows: `Ctrl+F5`

This forces the browser to reload the latest JavaScript and CSS.

## Raspberry Pi setup

Install the Python web dependency:

```bash
pip install -r requirements.txt
```

Install the LED libraries on the Pi:

```bash
sudo pip3 install rpi_ws281x adafruit-circuitpython-neopixel
```

Notes:

- `sudo` is for the Raspberry Pi, not Windows.
- If the Pi LED library is missing, the app falls back to a mock driver so the UI still works.
- Hardware settings are stored in `data/settings.json` after first launch.

## Running on the Pi

```bash
python -m app.main
```

Then open the Pi's IP address on port `8000` from another device on your network.

## Hardware notes

- This app currently assumes a single 50-pixel WS2811 string
- Real hardware control uses `rpi_ws281x`
- If that library is unavailable, the app automatically falls back to the mock driver
- Default driver and LED settings are stored in `data/settings.json`

## Next likely improvements

- Add color control
- Add LED groups
- Add scene presets
- Add a timeline editor
