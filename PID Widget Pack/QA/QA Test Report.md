# **📋 PID Public Transport Widget \- Comprehensive Test Report**

Project: PID Timetable Widget (iOS Scriptable)  
Final Version Tested: 5.3.4  
Date of Report: December 02, 2025  
Test Environment: iOS 18 (Scriptable App)  
GPS Location: Prague, Czechia (Simulated & Physical)

## **1\. Executive Summary**

This report documents the QA validation for the PID Timetable Widget lifecycle, from the initial static release (v1.2) to the final platform-aware GPS version (v5.3.4).

Overall Status: ✅ PASSED  
The widget has successfully transitioned from a hardcoded single-stop display to a dynamic, location-aware intelligent assistant. All critical features (GPS detection, Platform Grouping, and Walking Filters) function within defined parameters.

## **2\. Feature Verification Matrix (By Version)**

### **📦 Version 5.3.4 (Current Stable)**

Focus: Platform Grouping & UI Cleanup  
| Feature ID | Test Scenario | Status | Notes |  
| :--- | :--- | :--- | :--- |  
| GRP-01 | Platform Grouping | ✅ PASS | Departures correctly separate into headers (e.g., "Kačerov — A", "Kačerov — B"). |  
| GRP-02 | Walking Time | ✅ PASS | Calculates specific walk time per platform. "• nearby" triggers correctly at \<50m. |  
| UI-05 | GPS Accuracy | ✅ PASS | Footer displays GPS: ±10m. Updates dynamically based on signal. |  
| UI-06 | Badge Colors | ✅ PASS | Metro A (Green), B (Yellow), C (Red), Trams (Dark Red), Buses (Blue) render correctly. |

### **📦 Version 4.3.6 (Smart Commuter)**

Focus: Walking Logic & Time Formats  
| Feature ID | Test Scenario | Status | Notes |  
| :--- | :--- | :--- | :--- |  
| WLK-01 | Uncatchable Filter | ✅ PASS | Buses departing sooner than walking time (at 1.3 m/s) are hidden from list. |  
| WLK-02 | Buffer Logic | ✅ PASS | Metro lines correctly apply an extra 0.5 min buffer for station entry. |  
| TM-01 | Absolute Time | ✅ PASS | Departures \>10 mins show 14:35 format. Departures \<10 mins show relative X min. |  
| FB-01 | Fallback Search | ✅ PASS | If 0 stops found in 250m, radius auto-expands to find single nearest stop. |

### **📦 Version 3.3 (GPS Core)**

Focus: Location Services & Deduplication  
| Feature ID | Test Scenario | Status | Notes |  
| :--- | :--- | :--- | :--- |  
| LOC-01 | Stop Detection | ✅ PASS | Accurately identifies stops using pid\_stops\_db.json. |  
| DEDUP-01 | Trip Grouping | ✅ PASS | Prevents duplicate buses when standing between two physical stops (e.g., Chodov A vs B). |

### **📦 Version 2.4.2 (Legacy Architecture)**

Focus: Widget Modes & Stability  
| Feature ID | Test Scenario | Status | Notes |  
| :--- | :--- | :--- | :--- |  
| WID-01 | Medium Mode | ✅ PASS | Correctly renders split-view (2 columns) for Medium widgets. |  
| SYS-01 | Invisible Timer | ✅ PASS | Widget refreshes in background without "freezing" (via opacity:0 timer hack). |

## **3\. Defect & Resolution Summary**

During the development lifecycle, the following critical defects were identified and resolved:

| Defect ID | Version Found | Issue Description | Resolution Version | Fix Method |
| :---- | :---- | :---- | :---- | :---- |
| **DEF-01** | v1.2 | **Ghost Buses:** API showed buses that had already left. | v1.7 | Switched API from /vehiclepositions to /departureboards. |
| **DEF-02** | v2.3 | **Background Freeze:** Widget stopped updating after 1 hour. | v2.4.2 | Implemented hiddenTimerContainerStack to force iOS refresh. |
| **DEF-03** | v3.1 | **Duplicate Data:** Same bus appeared twice (once for Stop A, once for Stop B). | v3.3 | Added logic to group by TripID and keep only the closest stop. |
| **DEF-04** | v4.0 | **Uncatchable Buses:** Users ran for buses they physically couldn't catch. | v4.1 | Implemented AVERAGE\_WALKING\_SPEED\_MPS calculation logic. |
| **DEF-05** | v5.0 | **Platform Confusion:** Users didn't know which stand to go to at hubs. | v5.3.4 | Implemented Grouped Headers (e.g., "Stand A") logic. |

## **4\. Performance & Reliability**

### **Stress Testing (v5.3.4)**

* **Max Load:** Tested at *Smíchovské nádraží* (high density). Widget successfully rendered 5+ distinct platforms without layout breaking.  
* **Low Signal:** Tested with simulated poor GPS accuracy (\>100m). Widget gracefully degraded to show generic stop distance.  
* **Database:** 2.5MB JSON database loads in \<200ms on iPhone 13 Pro.

### **Battery Impact**

* **Optimization:** GPS is requested only on widget refresh.  
* **Impact:** Negligible background drain observed over 24h period.

## **5\. Final Recommendation**

**Release Decision:** 🚀 **GO**

Version **5.3.4** is stable, performant, and feature-complete.

* The transition to **Platform Grouping** significantly improves UX at major transport hubs.  
* The **Walking Filter** reduces user frustration by filtering impossible connections.  
* **GPS handling** is robust with adequate fallbacks.

Signed Off By:  
QA Lead, alanmakareem  
December 2, 2025