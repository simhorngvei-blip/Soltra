#!/usr/bin/env python3
"""
Soltra Node Monitor
Live terminal dashboard for all sensor node readings via MQTT.

Requirements:
    pip install paho-mqtt rich

Usage:
    python soltra_monitor.py
"""

import json
import threading
from datetime import datetime

import paho.mqtt.client as mqtt
from rich.console import Console
from rich.live import Live
from rich.table import Table
from rich.panel import Panel
from rich.columns import Columns
from rich import box

# ── Config ────────────────────────────────────────────────────────────────────
BROKER   = "broker.hivemq.com"
PORT     = 1883
TOPIC    = "soltra/telemetry"
# ─────────────────────────────────────────────────────────────────────────────

console = Console()

# Shared state
state = {
    "status":        "waiting...",
    "irradiance":    "--",
    "pan":           "--",
    "tilt":          "--",
    "power":         "--",
    "wind":          "--",
    "last_updated":  None,
    "nodes": {
        1: {"ldr": "--", "lux": "--", "uv": "--", "bat": "--"},
        2: {"ldr": "--", "lux": "--", "uv": "--", "bat": "--"},
        3: {"ldr": "--", "lux": "--", "uv": "--", "bat": "--"},
        4: {"ldr": "--", "lux": "--", "uv": "--", "bat": "--"},
    }
}
lock = threading.Lock()
connected = False


def on_connect(client, userdata, flags, rc, properties=None):
    global connected
    connected = (rc == 0)
    if connected:
        client.subscribe(TOPIC)


def on_disconnect(client, userdata, rc, properties=None, reason=None):
    global connected
    connected = False


def on_message(client, userdata, msg):
    global state
    try:
        d = json.loads(msg.payload.decode())
        with lock:
            state["status"]       = d.get("status", "--")
            state["irradiance"]   = f"{d['irradiance_wm2']:.1f}" if "irradiance_wm2" in d else "--"
            state["pan"]          = f"{d['pan_angle_deg']:.1f}°"  if "pan_angle_deg"  in d else "--"
            state["tilt"]         = f"{d['tilt_angle_deg']:.1f}°" if "tilt_angle_deg" in d else "--"
            state["power"]        = f"{d['power_watts']:.1f}"     if "power_watts"    in d else "--"
            state["wind"]         = f"{d['wind_speed_ms']:.1f}"   if "wind_speed_ms"  in d else "--"
            state["last_updated"] = datetime.now().strftime("%H:%M:%S")

            # Per-node readings
            if "nodes" in d and isinstance(d["nodes"], list):
                for node in d["nodes"]:
                    i = node.get("id")
                    if i in state["nodes"]:
                        state["nodes"][i] = {
                            "ldr": str(node.get("ldr", "--")),
                            "lux": f"{node['lux']} lx" if "lux" in node else "--",
                            "uv":  f"{node['uv']:.1f}"  if "uv"  in node else "--",
                            "bat": f"{node['bat']:.2f} V" if "bat" in node else "--",
                        }
    except Exception as e:
        pass


def build_display():
    with lock:
        s = dict(state)
        nodes = {k: dict(v) for k, v in state["nodes"].items()}

    conn_label  = "[bold green]● CONNECTED[/]" if connected else "[bold red]● DISCONNECTED[/]"
    last_upd    = s["last_updated"] or "no data yet"

    # ── System Overview ───────────────────────────────────────────────────────
    overview = Table(box=box.SIMPLE, show_header=False, padding=(0, 2))
    overview.add_column("Key",   style="dim", width=18)
    overview.add_column("Value", style="bold cyan")

    STATUS_COLOURS = {
        "tracking":        "bold green",
        "ldr_test_mode":   "bold yellow",
        "manual_override": "bold magenta",
        "low_light_standby": "dim",
        "night_reset":     "dim",
        "wind_stow":       "bold red",
        "ai_stow":         "bold red",
        "sensor_offline":  "bold red",
    }
    status_val = s["status"]
    status_col = STATUS_COLOURS.get(status_val, "white")

    overview.add_row("Status",     f"[{status_col}]{status_val}[/]")
    overview.add_row("Irradiance", f"{s['irradiance']} W/m²")
    overview.add_row("Pan Angle",  s["pan"])
    overview.add_row("Tilt Angle", s["tilt"])
    overview.add_row("Power Out",  f"{s['power']} W")
    overview.add_row("Wind Speed", f"{s['wind']} m/s")

    overview_panel = Panel(overview, title="[bold]System Overview[/]", border_style="blue")

    # ── Node Table ────────────────────────────────────────────────────────────
    node_table = Table(box=box.ROUNDED, border_style="dim", show_header=True, header_style="bold dim")
    node_table.add_column("Node",     style="bold cyan",  width=8)
    node_table.add_column("LDR",      justify="right",    width=8)
    node_table.add_column("Lux",      justify="right",    width=10)
    node_table.add_column("UV Index", justify="right",    width=10)
    node_table.add_column("Battery",  justify="right",    width=12)

    for i in range(1, 5):
        n = nodes[i]
        node_table.add_row(f"Node {i}", n["ldr"], n["lux"], n["uv"], n["bat"])

    node_panel = Panel(node_table, title="[bold]Sensor Node Readings[/]", border_style="blue")

    # ── Footer ────────────────────────────────────────────────────────────────
    footer = f"{conn_label}  [dim]broker:[/] {BROKER}  [dim]topic:[/] {TOPIC}  [dim]updated:[/] {last_upd}"

    from rich.align import Align
    from rich.text import Text
    return Panel(
        Columns([overview_panel, node_panel]),
        title="[bold white]☀  Soltra Node Monitor[/]",
        subtitle=footer,
        border_style="bright_blue",
        padding=(1, 2),
    )


def main():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect    = on_connect
    client.on_disconnect = on_disconnect
    client.on_message    = on_message

    console.print(f"[dim]Connecting to {BROKER}:{PORT} ...[/]")
    client.connect(BROKER, PORT, keepalive=60)
    client.loop_start()

    with Live(build_display(), refresh_per_second=2, screen=True) as live:
        try:
            while True:
                live.update(build_display())
                threading.Event().wait(0.5)
        except KeyboardInterrupt:
            pass

    client.loop_stop()
    console.print("[dim]Disconnected. Bye![/]")


if __name__ == "__main__":
    main()
