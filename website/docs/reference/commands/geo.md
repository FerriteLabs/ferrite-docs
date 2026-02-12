---
sidebar_position: 8
maturity: stable
---

# Geo Commands

Commands for geospatial data and queries.

## Overview

Geo commands store and query geographic locations (longitude/latitude pairs). Internally uses a sorted set with geohash encoding.

## Commands

### GEOADD

Add geospatial items.

```bash
GEOADD key [NX | XX] [CH] longitude latitude member [longitude latitude member ...]
```

**Options:**
- `NX` - Only add new members
- `XX` - Only update existing members
- `CH` - Return number of changed elements

**Time Complexity:** O(log(N)) per item

**Examples:**
```bash
GEOADD locations -122.4194 37.7749 "San Francisco"
# 1

GEOADD locations -73.9857 40.7484 "New York" -87.6298 41.8781 "Chicago"
# 2
```

---

### GEOPOS

Get position of members.

```bash
GEOPOS key member [member ...]
```

**Time Complexity:** O(N)

**Examples:**
```bash
GEOADD locations -122.4194 37.7749 "San Francisco"

GEOPOS locations "San Francisco"
# 1) 1) "-122.41940021514892578"
#    2) "37.77490010040205846"

GEOPOS locations "San Francisco" "Unknown"
# 1) 1) "-122.41940021514892578"
#    2) "37.77490010040205846"
# 2) (nil)
```

---

### GEODIST

Get distance between members.

```bash
GEODIST key member1 member2 [M | KM | FT | MI]
```

**Units:**
- `M` - Meters (default)
- `KM` - Kilometers
- `FT` - Feet
- `MI` - Miles

**Time Complexity:** O(1)

**Examples:**
```bash
GEOADD locations -122.4194 37.7749 "San Francisco" -73.9857 40.7484 "New York"

GEODIST locations "San Francisco" "New York" KM
# "4138.7971"

GEODIST locations "San Francisco" "New York" MI
# "2571.8567"
```

---

### GEOSEARCH

Search locations within area.

```bash
GEOSEARCH key FROMMEMBER member | FROMLONLAT longitude latitude
  BYRADIUS radius M | KM | FT | MI | BYBOX width height M | KM | FT | MI
  [ASC | DESC] [COUNT count [ANY]] [WITHCOORD] [WITHDIST] [WITHHASH]
```

**Time Complexity:** O(N+log(M))

**Examples:**
```bash
GEOADD locations -122.4194 37.7749 "San Francisco"
GEOADD locations -122.2711 37.8044 "Oakland"
GEOADD locations -121.8863 37.3382 "San Jose"

# Search by radius from member
GEOSEARCH locations FROMMEMBER "San Francisco" BYRADIUS 50 KM
# 1) "San Francisco"
# 2) "Oakland"

# Search by radius from coordinates
GEOSEARCH locations FROMLONLAT -122.4194 37.7749 BYRADIUS 100 KM WITHDIST
# 1) 1) "San Francisco"
#    2) "0.0000"
# 2) 1) "Oakland"
#    2) "12.8123"
# 3) 1) "San Jose"
#    2) "69.3412"

# Search within box
GEOSEARCH locations FROMLONLAT -122.4194 37.7749 BYBOX 100 100 KM
```

---

### GEOSEARCHSTORE

Store search results.

```bash
GEOSEARCHSTORE destination source FROMMEMBER member | FROMLONLAT longitude latitude
  BYRADIUS radius M | KM | FT | MI | BYBOX width height M | KM | FT | MI
  [ASC | DESC] [COUNT count [ANY]] [STOREDIST]
```

**Time Complexity:** O(N+log(M))

**Examples:**
```bash
GEOSEARCHSTORE nearby_sf locations FROMMEMBER "San Francisco" BYRADIUS 50 KM

ZRANGE nearby_sf 0 -1 WITHSCORES
```

---

### GEORADIUS (Deprecated)

Search by radius from coordinates. Use GEOSEARCH instead.

```bash
GEORADIUS key longitude latitude radius M | KM | FT | MI [WITHCOORD] [WITHDIST] [WITHHASH] [COUNT count [ANY]] [ASC | DESC] [STORE key] [STOREDIST key]
```

---

### GEORADIUSBYMEMBER (Deprecated)

Search by radius from member. Use GEOSEARCH instead.

```bash
GEORADIUSBYMEMBER key member radius M | KM | FT | MI [WITHCOORD] [WITHDIST] [WITHHASH] [COUNT count [ANY]] [ASC | DESC] [STORE key] [STOREDIST key]
```

---

### GEOHASH

Get geohash strings.

```bash
GEOHASH key member [member ...]
```

**Time Complexity:** O(N)

**Examples:**
```bash
GEOADD locations -122.4194 37.7749 "San Francisco"

GEOHASH locations "San Francisco"
# 1) "9q8yy9m5k60"
```

## Use Cases

### Store Locator

```bash
# Add store locations
GEOADD stores -122.4194 37.7749 "store:1"
GEOADD stores -122.4089 37.7833 "store:2"
GEOADD stores -122.4019 37.7941 "store:3"

# Find stores within 5km of user
GEOSEARCH stores FROMLONLAT -122.4100 37.7800 BYRADIUS 5 KM WITHDIST ASC

# Store additional info in hash
HSET store:1 name "Downtown Store" address "123 Main St" hours "9am-9pm"
HSET store:2 name "Marina Store" address "456 Bay St" hours "10am-8pm"
```

### Delivery Radius

```bash
# Add restaurant locations
GEOADD restaurants -122.4194 37.7749 "restaurant:1"
GEOADD restaurants -122.4089 37.7833 "restaurant:2"

# Check if address is within delivery radius (5km)
GEOSEARCH restaurants FROMLONLAT -122.4100 37.7800 BYRADIUS 5 KM

# Or calculate distance directly
GEODIST restaurants "restaurant:1" FROMLONLAT -122.4100 37.7800 KM
```

### Nearby Users

```bash
# Update user location
GEOADD user_locations -122.4194 37.7749 "user:1"
GEOADD user_locations -122.4100 37.7800 "user:2"
GEOADD user_locations -122.3900 37.8000 "user:3"

# Find users within 10km
GEOSEARCH user_locations FROMMEMBER "user:1" BYRADIUS 10 KM COUNT 50 WITHDIST
```

### Fleet Tracking

```bash
# Update vehicle positions
GEOADD fleet -122.4194 37.7749 "vehicle:truck1"
GEOADD fleet -122.4089 37.7833 "vehicle:truck2"
GEOADD fleet -122.4019 37.7941 "vehicle:truck3"

# Find vehicles near a destination
GEOSEARCH fleet FROMLONLAT -122.4000 37.8000 BYRADIUS 2 KM WITHDIST ASC COUNT 1

# Track distance between vehicles
GEODIST fleet "vehicle:truck1" "vehicle:truck2" KM
```

### Geofencing

```bash
# Define geofence center
SET geofence:office:center "-122.4194,37.7749"
SET geofence:office:radius "500"  # meters

# Check if user is within geofence
GEOADD temp_check -122.4190 37.7745 "user:check"
GEODIST temp_check "user:check" FROMLONLAT -122.4194 37.7749 M
# If distance < 500, user is within geofence
```

## Rust API

```rust
use ferrite::Client;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::connect("localhost:6379").await?;

    // Add locations
    client.geoadd("locations", &[
        (-122.4194, 37.7749, "San Francisco"),
        (-73.9857, 40.7484, "New York"),
        (-87.6298, 41.8781, "Chicago"),
    ]).await?;

    // Get position
    let pos = client.geopos("locations", "San Francisco").await?;
    if let Some((lon, lat)) = pos {
        println!("San Francisco: {}, {}", lon, lat);
    }

    // Calculate distance
    let dist = client.geodist("locations", "San Francisco", "New York", "km").await?;
    println!("Distance: {} km", dist);

    // Search by radius
    let results = client.geosearch(
        "locations",
        GeoSearchFrom::LonLat(-122.4194, 37.7749),
        GeoSearchBy::Radius(100.0, "km"),
        GeoSearchOptions::default()
            .with_dist()
            .asc()
            .count(10),
    ).await?;

    for result in results {
        println!("{}: {} km", result.member, result.dist.unwrap());
    }

    Ok(())
}
```

## Performance Considerations

- Geo commands use a sorted set internally
- Geohash precision is ~0.6m (52-bit precision)
- For large datasets, consider partitioning by region
- Use COUNT to limit results for radius queries

## Related Commands

- [Sorted Set Commands](/docs/reference/commands/sorted-sets) - Underlying data structure
- [Vector Commands](/docs/reference/commands/vector) - For similarity search
- [Search Commands](/docs/reference/commands/search) - Full-text search with geo filters
