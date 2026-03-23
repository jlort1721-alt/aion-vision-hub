#!/usr/bin/env python3
"""
Clave Seguridad — Raspberry Pi GPIO Relay Agent

Lightweight HTTP API server for controlling GPIO relay modules
connected to a Raspberry Pi. Designed for gate/door/barrier control.

Installation:
    pip install flask RPi.GPIO

Usage:
    python3 raspberry-pi-agent.py --port 5000

API Endpoints:
    POST /gpio/{pin}/on         - Turn relay ON
    POST /gpio/{pin}/off        - Turn relay OFF
    POST /gpio/{pin}/pulse?duration=3000  - Pulse ON for N ms
    GET  /gpio/{pin}/state      - Get current state
    GET  /health                - Agent health check
    GET  /pins                  - List configured pins

Environment Variables:
    PI_AGENT_PORT=5000          - HTTP port (default: 5000)
    PI_AGENT_HOST=0.0.0.0      - Bind address (default: 0.0.0.0)
    PI_RELAY_PINS=17,27,22,23  - Comma-separated GPIO BCM pins (default: 17,27,22,23)
    PI_RELAY_ACTIVE_LOW=true   - Relay module active-low logic (default: true)

Compatible with:
    - 1/2/4/8 channel relay modules
    - Sonoff SV (GPIO14)
    - Custom relay boards
"""

import os
import sys
import time
import json
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Configuration
PORT = int(os.environ.get('PI_AGENT_PORT', '5000'))
HOST = os.environ.get('PI_AGENT_HOST', '0.0.0.0')
RELAY_PINS = [int(p) for p in os.environ.get('PI_RELAY_PINS', '17,27,22,23').split(',')]
ACTIVE_LOW = os.environ.get('PI_RELAY_ACTIVE_LOW', 'true').lower() == 'true'

# Try to import RPi.GPIO, fall back to mock for development
try:
    import RPi.GPIO as GPIO
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    for pin in RELAY_PINS:
        GPIO.setup(pin, GPIO.OUT)
        GPIO.output(pin, GPIO.HIGH if ACTIVE_LOW else GPIO.LOW)  # Start OFF
    HAS_GPIO = True
    print(f"[GPIO] Initialized pins: {RELAY_PINS} (active_low={ACTIVE_LOW})")
except (ImportError, RuntimeError):
    HAS_GPIO = False
    print("[GPIO] RPi.GPIO not available — running in simulation mode")

# Pin state tracking (for mock mode)
pin_states = {pin: False for pin in RELAY_PINS}


def set_pin(pin, state):
    """Set GPIO pin to ON (True) or OFF (False)."""
    if pin not in RELAY_PINS:
        return False

    pin_states[pin] = state

    if HAS_GPIO:
        if ACTIVE_LOW:
            GPIO.output(pin, GPIO.LOW if state else GPIO.HIGH)
        else:
            GPIO.output(pin, GPIO.HIGH if state else GPIO.LOW)

    return True


def get_pin(pin):
    """Get current state of a GPIO pin."""
    if pin not in RELAY_PINS:
        return None
    return pin_states.get(pin, False)


def pulse_pin(pin, duration_ms):
    """Turn pin ON for duration_ms then OFF."""
    def _pulse():
        set_pin(pin, True)
        time.sleep(duration_ms / 1000.0)
        set_pin(pin, False)

    thread = threading.Thread(target=_pulse, daemon=True)
    thread.start()


class GPIOHandler(BaseHTTPRequestHandler):
    """HTTP request handler for GPIO control."""

    def log_message(self, format, *args):
        print(f"[{time.strftime('%H:%M:%S')}] {format % args}")

    def send_json(self, status, data):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.strip('/')
        parts = path.split('/')

        # GET /health
        if path == 'health':
            self.send_json(200, {
                'status': 'healthy',
                'gpio_available': HAS_GPIO,
                'pins': RELAY_PINS,
                'active_low': ACTIVE_LOW,
                'states': {str(p): 'on' if pin_states.get(p) else 'off' for p in RELAY_PINS},
                'uptime_seconds': int(time.time() - START_TIME),
            })
            return

        # GET /pins
        if path == 'pins':
            self.send_json(200, {
                'pins': [{
                    'pin': p,
                    'state': 'on' if pin_states.get(p) else 'off',
                    'configured': True,
                } for p in RELAY_PINS],
            })
            return

        # GET /gpio/{pin}/state
        if len(parts) == 3 and parts[0] == 'gpio' and parts[2] == 'state':
            try:
                pin = int(parts[1])
            except ValueError:
                self.send_json(400, {'error': 'Pin inválido'})
                return

            state = get_pin(pin)
            if state is None:
                self.send_json(404, {'error': f'Pin {pin} no configurado'})
                return

            self.send_json(200, {'pin': pin, 'state': 'on' if state else 'off'})
            return

        self.send_json(404, {'error': 'Endpoint no encontrado'})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.strip('/')
        query = parse_qs(parsed.query)
        parts = path.split('/')

        # POST /gpio/{pin}/{action}
        if len(parts) == 3 and parts[0] == 'gpio':
            try:
                pin = int(parts[1])
            except ValueError:
                self.send_json(400, {'error': 'Pin inválido'})
                return

            if pin not in RELAY_PINS:
                self.send_json(404, {'error': f'Pin {pin} no configurado. Pines disponibles: {RELAY_PINS}'})
                return

            action = parts[2]

            if action == 'on':
                set_pin(pin, True)
                self.send_json(200, {'pin': pin, 'action': 'on', 'success': True})

            elif action == 'off':
                set_pin(pin, False)
                self.send_json(200, {'pin': pin, 'action': 'off', 'success': True})

            elif action == 'pulse':
                duration = int(query.get('duration', ['3000'])[0])
                pulse_pin(pin, duration)
                self.send_json(200, {'pin': pin, 'action': 'pulse', 'duration_ms': duration, 'success': True})

            elif action == 'toggle':
                current = get_pin(pin)
                set_pin(pin, not current)
                self.send_json(200, {'pin': pin, 'action': 'toggle', 'new_state': 'on' if not current else 'off', 'success': True})

            else:
                self.send_json(400, {'error': f'Acción no válida: {action}. Use: on, off, pulse, toggle'})

            return

        self.send_json(404, {'error': 'Endpoint no encontrado'})


START_TIME = time.time()

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Clave Seguridad — Raspberry Pi GPIO Agent')
    parser.add_argument('--port', type=int, default=PORT, help=f'HTTP port (default: {PORT})')
    parser.add_argument('--host', type=str, default=HOST, help=f'Bind address (default: {HOST})')
    args = parser.parse_args()

    server = HTTPServer((args.host, args.port), GPIOHandler)
    print(f"╔══════════════════════════════════════════════╗")
    print(f"║  Clave Seguridad — Raspberry Pi GPIO Agent  ║")
    print(f"║  Listening on {args.host}:{args.port}              ║")
    print(f"║  Pins: {RELAY_PINS}                         ║")
    print(f"║  GPIO: {'REAL' if HAS_GPIO else 'SIMULATION'}                          ║")
    print(f"╚══════════════════════════════════════════════╝")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Agent] Shutting down...")
        if HAS_GPIO:
            GPIO.cleanup()
        server.server_close()
