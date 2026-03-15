# AION Vision Hub — Access Control Module

## Overview
Comprehensive access management for residents, visitors, pedestrians, and vehicles across 50 sections.

## Data Model
- `access_people`: Residents, visitors with document, phone, unit, photo
- `access_vehicles`: Vehicles linked to people with plate, brand, color
- `access_logs`: Entry/exit logs with direction, method, operator
- `sections`: Organizational units (gates, buildings, zones)

## Features
- Resident/visitor CRUD with section assignment
- Vehicle management linked to residents
- Access log tracking (in/out, method, operator)
- Section-based filtering and organization
- Quick search by name, document, plate
- Status management (active/inactive)
- Reporting: daily, weekly, biweekly, monthly

## Integration Points
- **Live View**: Quick resident/vehicle lookup, gate open actions
- **Playback**: Correlate access events with video footage
- **AION Agent**: Natural language queries for access history
- **LPR** (Planned): License plate recognition integration
- **Biometrics** (Planned): Fingerprint/face recognition devices
- **ZKTeco UHF** (Planned): Antenna-based vehicle tag reading

## Reports
- Daily/weekly/biweekly/monthly access summaries
- Filter by section, access type, person type
- Export to CSV/Excel
