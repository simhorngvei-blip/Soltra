# Soltra Sensor Node - PCB Deployment Guide

This directory contains the firmware and hardware design specifications for the final PCB deployment of the Soltra Sensor Node. 

The core microcontroller for this node is the **Seeed Studio XIAO ESP32C3**. The PCB is designed to be powered by a LiPo battery which is trickle-charged via a solar panel connected to the XIAO's USB-C port.

## 1. Power & Shipping Considerations (Mechanical Switch)
Because the devices will be shipped to users and may remain in transit for 15+ days, it is **critical** to completely disconnect the LiPo battery during transit. 

To prevent the battery from swelling or dying due to deep discharge:
- A **Hardware Mechanical Toggle Switch** must be placed directly in-line between the LiPo battery and the XIAO's `BAT` pads.
- When this switch is set to "OFF", the XIAO receives zero power from the battery. 
- *Note:* Because the solar panel plugs directly into the USB-C port, turning the device "OFF" means it **will not** charge the battery, as the battery is physically disconnected from the XIAO's internal charge IC. This is by design to ensure battery safety during shipping and storage.

## 2. Pin Assignments & Connections

### Sensors
*   **BAT_PIN (A0)**: Battery voltage measurement. (Remember to use a voltage divider if checking voltages higher than the ESP32C3's 3.3V ADC limit).
*   **LDR_PIN (A1)**: Analog input for LDR (Light Dependent Resistor).
*   **UV_PIN (A2)**: Analog input for UV sensor.
*   **I2C (D4 / D5)**: SDA and SCL for the **Adafruit TSL2591** light sensor.
*   **BOOT / CLEAR_CONFIG_PIN (D9)**: Grounding this pin while booting clears the saved WiFi config and triggers the captive portal setup mode.

### Indicator LEDs
The firmware handles three LEDs. Ensure they are routed on the PCB with appropriate current-limiting resistors.

*   **TX LED (`D3`)**: Flashes briefly (Active LOW) to indicate a payload was successfully sent to the Heltec master hub via ESP-NOW.
*   **Power LED (`D6`)**: (Active HIGH) Turns on while the XIAO is awake. Because the XIAO spends 99% of its time in deep sleep (waking for ~150ms every 2 seconds), this LED will briefly flash every 2 seconds to indicate it is alive, saving battery power.
*   **Charge LED (`D7`)**: (Active HIGH) Flashes when solar charging is active. 

### Detecting Solar Power / Charging (`D8`)
Because the XIAO uses its internal PMIC/Charge controller to charge the battery from USB-C, the code cannot natively read the charging state. 

To give the code an indicator that solar is active (and thus charging the battery):
1.  Run a trace from the XIAO's **`5V` pad** (which receives power directly from the USB-C solar panel).
2.  Pass it through a **Voltage Divider** to step the 5V down to a safe ~3.3V logic level.
3.  Route the stepped-down voltage to pin **`D8`**.
4.  When `D8` receives a HIGH signal, the firmware turns on the `LED_CHARGE_PIN`.

*(Alternatively, to save code complexity and MCU wake-time, you can completely bypass the firmware and simply wire an LED directly between the 5V pad and GND with a resistor. It will illuminate whenever solar power is present).*

## 3. Firmware Notes
- **ESP-NOW**: Nodes only speak ESP-NOW directly to the Heltec Master Hub. They do not connect to external WiFi networks or the internet.
- **Deep Sleep**: To preserve the small battery, the ESP32C3 operates in a deep sleep cycle, waking for a fraction of a second every 2 seconds to read sensors, transmit, and immediately sleep again.
- **Zero-Config Setup**: On the first boot (or if `D9` is grounded on boot), the node creates a captive portal hotspot (`Soltra-Node-X-Setup`). Users connect to it to synchronize the node to the local WiFi channel being used by the Master Hub.
