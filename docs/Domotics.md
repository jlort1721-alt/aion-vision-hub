# AION Vision Hub — Domotics Module

## Overview
Manages IoT/domotic devices (Sonoff, eWeLink ecosystem) across 50 configurable sections.

## Data Model
- `domotic_devices`: Device registry with type, brand, model, status, state
- `domotic_actions`: Action audit log per device

## Device Types
- Door, Lock, Siren, Light, Relay, Sensor, Switch

## Features
- Section-based organization (50 sections)
- Device state toggling (on/off)
- Real-time status monitoring (online/offline/error)
- Action history with operator tracking
- Health checks and last sync timestamps
- Quick actions: activate, deactivate, test connection

## Integration with Live View
- Quick action buttons per section in Live View
- Toggle doors, sirens, lights from camera view
- Alert badges for device errors

## Backend Integration (Planned)
- eWeLink API via Edge Function for Sonoff device control
- Device discovery and pairing
- Scheduled automations
- Webhook-based state sync
