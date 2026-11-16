# Nearby bus data sources

The bundled index contains public boarding-stop records captured on 16 November 2026 (Hong Kong time). The key is the operator source and the operator's own stop ID. IDs stay as strings, including Citybus leading zeros. Stations with the same name or coordinates keep their own records. The source timestamps record capture time.

| Source | Records | Official data and scope |
| --- | ---: | --- |
| Kowloon Motor Bus / Long Win Bus | 6,757 | [Stop catalogue](https://data.etabus.gov.hk/v1/transport/kmb/stop). One source row was excluded by coordinate validation. The operator catalogue identifies these stops through the shared KMB/LWB source. |
| Citybus | 752 | [Citybus V2 route-stop and stop data](https://www.citybus.com.hk/datagovhk/bus_eta_data_dictionary.pdf). The build collects stop IDs for both directions of 23 selected routes, then requests each distinct ID from the official Citybus V2 stop endpoint and checks that it matches the response. This is partial coverage. Transport Department stop IDs belong to a separate dataset and are not mapped to Citybus IDs by name or proximity. |
| New Lantao Bus | 332 | [NLB V2 list of stops by route ID](https://www.nlb.com.hk/datagovhk/BusServiceOpenAPIDocumentation2.0.pdf). The build uses all 66 route IDs from the sampled official catalogue, deduplicating only by NLB's stop ID. Coverage follows the routes present in that catalogue. |

The app imports the bundled snapshot into SQLite on first use. A newer bundle can refresh each source individually. When the KMB/LWB data is at least seven days old, the nearby screen can fetch its official stop catalogue and replace it transactionally. Citybus and NLB snapshot updates use the offline build. A failed KMB/LWB update leaves the local records available. The stored locations in this index belong to official stops. Device coordinates are used only in memory and as transient parameters for the local distance query.

Build the snapshot from the project root with Python 3 and curl. Provide a new temporary directory for a fresh download. Reusing that directory resumes an interrupted build using its already downloaded official responses.

```sh
python3 scripts/build-nearby-stops.py --cache-dir "$(mktemp -d)"
```

## Manual search points

The public landmark name is matched against the [Lands Department Location Search API](https://data.gov.hk/en-data/dataset/hk-landsd-openmap-development-location-search-api). The selected HK1980 easting and northing are converted with the [Lands Department Coordinates Transformation API](https://data.gov.hk/en-data/dataset/hk-landsd-openmap-coordinates-transformation-api). Each point is a search center for a radius in WGS84.

| Landmark | HK1980 easting | HK1980 northing | WGS84 latitude | WGS84 longitude |
| --- | ---: | ---: | ---: | ---: |
| Yuen Long MTR Station | 821681 | 834078 | 22.446072302 | 114.035165304 |
| Hung Shui Kiu Light Rail Stop | 817788 | 832706 | 22.433644950 | 113.997361840 |
| Tuen Mun Town Plaza | 815694 | 828201 | 22.392938957 | 113.977079236 |
| New Town Plaza, Sha Tin | 837441 | 826921 | 22.381502855 | 114.188264527 |
| Hong Kong Cultural Centre, Tsim Sha Tsui | 835599 | 817190 | 22.293626612 | 114.170382250 |
| Times Square, Causeway Bay | 836808 | 815492 | 22.278292642 | 114.182114037 |
| Central Ferry Pier | 834672 | 816382 | 22.286329259 | 114.161387270 |

## Stop-to-route index

`nearby-stop-routes.json` is a bundled reverse index. It stores each official route direction and variant once. Each operator stop ID points to route-option indices and the official stop sequences. Separate visits to the same stop remain separate. The index is available offline and is rebuilt with the app release.

| Source | Route options | Stops with linked routes | Stop visits | Coverage |
| --- | ---: | ---: | ---: | --- |
| KMB / LWB | 1,591 | 6,755 | 36,180 | [Official bulk Route-Stop](https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb/resource/d8c9ef3e-e4c9-4786-aaa6-9a3bd7a5d8c7) and official route catalogue. Two stops in the bundled spatial index have no route link in the sampled data. |
| Citybus | 45 | 752 | 1,179 | Verified official outbound and inbound visits from the existing 23-route subset. For a verified direction, the official catalogue provides the public destination label. Some circular services have a different final stop in Route-Stop. |
| NLB | 66 | 332 | 1,461 | Official Route-Stop arrays for the 66 route IDs. Direction labels and variant origins come from the official route names. A repeated visit keeps its own sequence even when the ETA endpoint shares its prediction. |

To refresh the route index, run the stop builder with a new scratch directory and then use the same directory with the route builder. The latter reads the verified Citybus and NLB responses written by the stop builder and downloads the two official KMB catalogues. These build-time requests do not run in the app.

```sh
nearby_cache="$(mktemp -d)"
python3 scripts/build-nearby-stops.py --cache-dir "$nearby_cache"
python3 scripts/build-nearby-stop-routes.py --cache-dir "$nearby_cache"
```

ETA is held in memory on the station page. [The official KMB Stop ETA endpoint](https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb/resource/12185102-718d-4d03-bfd7-b9ecf760aee2) returns one response for the stop. Matching uses the route number, direction, service type and stop sequence. Identical numbered departures shared across service types at the same visit are displayed once. Citybus requests share the response for a route at the same stop, and NLB requests share the response for the same route ID and stop ID.
