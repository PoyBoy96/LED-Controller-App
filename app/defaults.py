from __future__ import annotations

from copy import deepcopy
from typing import Any


LED_COUNT = 50

DEFAULT_ALLOWED_KEYS = [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "0",
    "Q",
    "W",
    "E",
    "R",
    "T",
    "Y",
    "U",
    "I",
    "O",
    "P",
    "A",
    "S",
    "D",
    "F",
    "G",
    "H",
    "J",
    "K",
    "L",
    "Z",
    "X",
    "C",
    "V",
    "B",
    "N",
    "M",
]


def make_default_led(physical_id: int) -> dict[str, Any]:
    return {
        "physical_id": physical_id,
        "display_name": "",
        "x": None,
        "y": None,
        "key": "",
        "placed": False,
    }


def make_default_layout(led_count: int = LED_COUNT) -> dict[str, Any]:
    return {
        "background_image": "",
        "updated_at": None,
        "leds": [make_default_led(index) for index in range(1, led_count + 1)],
    }


def make_default_settings() -> dict[str, Any]:
    return {
        "led_count": LED_COUNT,
        "default_brightness": 96,
        "default_toggle_behavior": "toggle",
        "allowed_keys": deepcopy(DEFAULT_ALLOWED_KEYS),
        "driver": "auto",
        "pin": 18,
        "frequency_hz": 800000,
        "dma_channel": 10,
        "invert_signal": False,
        "channel": 0,
        "active_color": [255, 170, 48],
    }

