// Load google maps and then call 'initialize'
google.maps.event.addDomListener(window, 'load', initialize);


// Once google is loaded, grab the topology data and draw the map
function initialize() {
    var url_params = getURLParameters();
    var center_lat = Number(url_params.lat) || 38.0;
    var center_lon = Number(url_params.lon) || -98.0;
    var zoom = Number(url_params.zoom) || 4;
    var map = initMap(zoom, center_lat, center_lon);
    var base_name = url_params.base_name || 'lwtesting_stitchtest';
    // Let the map show up, then paint the experiment data
    // momentarily (200 millis).
    setTimeout(makeGrabFunction(map, base_name), 200);
    setInterval(makeGrabFunction(map, base_name), 10 * 1000);
}

function makeGrabFunction(map, base_name) {
    return function() {
        $.getJSON('grab_visualization_data.php?base_name=' + base_name,
                  function(data) {
                      displayData(map, data);
                  })
    };
}

// Get site info by site_id
function getSiteById(site_id, data)
{
    for(var i = 0; i < data.sites.length; i++) {
        var site = data.sites[i];
        if(site.id == site_id)
            return site;
    }
    return null;
}

// Get coordinates object for given site_id
function getCoordsForSiteId(site_id, data)
{
    var site = getSiteById(site_id, data);
    return new google.maps.LatLng(site.latitude, site.longitude);
}

// Get coordinates for a given node (from its site id)
function getCoordsForNodeId(node_id, data)
{
    for(var i = 0; i < data.nodes.length; i++) {
        var node = data.nodes[i];
        if(node.id == node_id) {
            return getCoordsForSiteId(node.site_id, data);
        }
    }
    return null;
}

// Draw the map
// Add nodes and links
function initMap(zoom, center_lat, center_lon)
{
    var mapOptions = {
        zoom: zoom,
        center: new google.maps.LatLng(center_lat, center_lon),
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        panControl: false,
        zoomControl: true,
        mapTypeControl: false,
        scaleControl: false,
        streetViewControl: false,
        overviewMapControl: false,
        styles: [
            {
                featureType: "administrative",
                elementType: "labels",
                stylers: [
                    { visibility: "off" }
                ]
            },
            {
                featureType: "administrative.neighborhood",
                stylers: [
                    { visibility: "off" }
                ]
            },
            {
                featureType: "landscape",
                stylers: [
                    { visibility: "off" }
                ]
            },
            {
                featureType: "poi",
                stylers: [
                    { visibility: "off" }
                ]
            },
            {
                featureType: "road",
                stylers: [
                    { visibility: "off" }
                ]
            },
            {
                featureType: "transit",
                stylers: [
                    { visibility: "off" }
                ]
            },
            {
                featureType: "water",
                elementType: "labels",
                stylers: [
                    { visibility: "off" }
                ]
            }
        ]
    };

    var map = new google.maps.Map(document.getElementById('map-canvas'), 
                                  mapOptions);
    return map;
}

function displayData(map, data) {
    map.geniMarkers || (map.geniMarkers = []);
    map.geniPaths || (map.geniPaths = []);
    var i;
    var deleted = false;

    // Remove all previous markers and paths from map
    $.each(map.geniMarkers, function(i, marker) { marker.setMap(null);
                                                  deleted = true; });
    map.geniMarkers = [];
    $.each(map.geniPaths, function(i, path) { path.setMap(null);
                                              deleted = true; });
    map.geniPaths = [];

    // Temporary for testing
    if (deleted) { return; }

    // Draw Nodes, with radius proportional to number of nodes at site
    var site_counts = {};
    for(var i = 0; i < data.nodes.length; i++) {
        var node = data.nodes[i];
        var site_id = node.site_id;
        if (!(site_id in site_counts)) {
            site_counts[site_id] = 0;
        }
        site_counts[site_id] = site_counts[site_id] + 1;
    }
    for(var site_id in site_counts) {
        var site_count = site_counts[site_id];
        var site_coords = getCoordsForSiteId(site_id, data);
        var site_radius = 2 * site_count;
        siteOptions = {
            strokeColor: 'black',
            strokeOpacity: 0.8,
            strokeWeight:  2,
            fillColor: 'blue',
            fillOpacity: 0.35,
            map:map,
            center: site_coords,
            radius: site_radius
        };
        //circle = new google.maps.Circle(siteOptions);
        var marker = new google.maps.Marker({
            position: site_coords,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: site_radius,
                strokeWeight: 1,
            },
            map: map
        });
        map.geniMarkers.push(marker);
    }

    // Draw links 
    for(var i = 0; i < data.links.length; i++) {
        var link = data.links[i];
        from_node_id = link.from_id;
        to_node_id = link.to_id;
        var pathCoords = [
            getCoordsForNodeId(from_node_id, data),
            getCoordsForNodeId(to_node_id, data)
        ];
        var path = new google.maps.Polyline({
            path: pathCoords,
            geodesic: true,
            strokeColor : 'green',
            strokeOpacity: 1.0,
            strokeWeight : 2
        });
        path.setMap(map);
        map.geniPaths.push(path);
    }
}
