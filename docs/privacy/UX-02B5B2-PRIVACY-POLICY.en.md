# KongDaily Privacy Policy

**Draft for upcoming release** · Revised 2026-11-21 (Hong Kong time) · The effective date is pending developer confirmation.

This draft covers the MTR and Light Rail features planned for the upcoming release. Those features are absent from iOS 1.0.0 (Build 2), which remains covered by the current policy. [Current Privacy Policy v1.0](https://kongdaily-site.vercel.app/en/privacy/)

How KongDaily uses location, stores information on your device and makes requests to third-party services.

## Scope

This notice covers KongDaily’s iOS app, public website and support email. KongDaily is provided by Lenny, an individual developer operating under the Lenny Studio brand. You can use bus information, weather, Nearby, Explore and bookmarks without creating an account. The upcoming release’s MTR and Light Rail directories and train predictions also work without an account.

## Location and permissions

The app uses foreground location to calculate distances, suggest nearby bus stops, and show and centre your location on the Nearby map. Opening a relevant screen may request a single location reading if you have already granted access. The app has no background location or location history.

Transport Search may use device location when it shows nearby bus results. Browsing or searching the MTR and Light Rail directories does not require a device location reading.

You can manage access and Precise Location in iOS Settings. If you deny access or your position is not accurate enough, you can still select a landmark, move the map or search for a place. Apple’s Location Services and Apple Maps explain their own data handling.

- [Apple Location Services & Privacy](https://www.apple.com/legal/privacy/data/en/location-services/)
- [Apple Maps & Privacy](https://www.apple.com/legal/privacy/data/en/apple-maps/)

## Local storage and search

The app uses an on-device SQLite database for bus and facility bookmarks, pinned stops, your language preference, up to eight recent bus searches, and cached public bus and weather data. Global Search matches text on your device. If the bus route catalogue needs to be updated, the catalogue request does not include your search text.

Transport Search also matches routes and stops on your device. The static MTR and Light Rail directories are included in the app and can be browsed and searched offline. The app does not send these search terms to the railway service.

Your current location and Nearby results may be kept temporarily in app memory. If you use iOS backups, local app data may be included in a device backup and restored later.

## Online requests and external services

The app requests route, stop and arrival information from official KMB and Long Win, Citybus and New Lantao Bus services. Requests can include public route or stop identifiers. Hong Kong Observatory weather requests include the data type and language.

The app does not attach device GPS coordinates or search terms to those bus or weather requests. Nearby bus features may use on-device distance calculations to select the public stops to query. These services can receive ordinary connection information such as IP addresses. Their published interface documentation does not specify how long any request logs are kept.

In Nearby place search, eligible text is sent automatically over HTTPS to the Lands Department’s Location Search API. This may include an address you type. The app does not attach your device’s GPS coordinates to this request. The service can receive connection information such as an IP address and may handle the query and connection data under its applicable policies. The published API documentation does not say whether queries are logged or how long any logs are kept.

Apple MapKit supplies the maps in the app. The Nearby map may use your device location as a map marker or to centre the map. Apple’s Location Services and Apple Maps may process location and connection data according to your settings and Apple’s privacy policies. If you open directions in Apple Maps or Google Maps, the app passes the chosen destination and walking mode. External map services and websites handle data under their own policies and permissions.

If you choose to send a support or privacy email, the operator receives the name, email address, description of the issue and any attachments you provide through the mail service to handle and respond to your request.

KongDaily uses Vercel to host its public website. When you visit, the hosting provider may process connection information such as your IP address to serve pages and operate and protect the service. The site itself has no accounts, contact forms or analytics trackers.

- [Lands Department Location Search API](https://data.gov.hk/en-data/dataset/hk-landsd-openmap-development-location-search-api)
- [Lands Department Personal Information Collection Statement and contact](https://www.landsd.gov.hk/en/about-us/contact-us/collection-statement.html)
- [Google Privacy Policy](https://policies.google.com/privacy?hl=en)
- [Vercel Privacy Notice](https://vercel.com/legal/privacy-notice)

## Real-time MTR and Light Rail predictions

When you view live predictions in a station’s details, the app requests train data supplied by MTR Corporation Limited through the HKSAR Government’s DATA.GOV.HK real-time data service. MTR requests send the public codes for the selected line and station and a fixed option to receive the response in English. Light Rail requests send the public identifier of the selected stop and ask for special service information to be included.

The app does not attach device GPS coordinates, search terms, account information or app-added device identifiers to these requests. The gateway and service provider may process connection information such as IP addresses, request times and standard request headers. Available public documentation does not specify whether each party keeps or can access that information or the requested codes after responding, or how long any records are kept.

The app may make a request when you open the prediction view, when the relevant station screen returns to the foreground or when you refresh it. The app may briefly reuse responses in memory and does not write them to its local database. Expired predictions are no longer shown as live. The app does not poll for train predictions in the background.

- [Real-time MTR train information](https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data)
- [Real-time Light Rail train information](https://data.gov.hk/en-data/dataset/mtr-lrnt_data-light-rail-nexttrain-data)

## Retention and deletion

You can remove bookmarks or pins individually and clear recent searches on the Bus page. The app refreshes cached public data as features need it. Deleting the app removes its local app data. Offloading the app keeps its documents and data.

Manage iOS backups separately in system settings. External providers handle any data they retain under their applicable policies and procedures.

The operator keeps ordinary support emails and related attachments for up to 12 months after the case is resolved, unless applicable law requires longer retention. You can request deletion using the privacy email address below.

The operator’s support email deletion process applies to copies under the operator’s control. The email provider manages its own backups, logs and retention arrangements, and the operator cannot guarantee when the provider deletes those records. The website host handles connection data it retains independently under its applicable policies.

## Data security

The app makes its service requests over HTTPS and stores local data in its iOS app container.

## Your choices and contact

You can change or withdraw location permission in iOS Settings. Use the official privacy contact for questions or to request access to, correction of, or deletion of personal data held by the operator.

- [lenny996@163.com](mailto:lenny996@163.com)

## Policy updates

When the privacy policy changes, the public website will state the applicable policy version and the last updated date.
