//----------------------------------------------------------------------
// Copyright (c) 2012-2015 Raytheon BBN Technologies
//
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and/or hardware specification (the "Work") to
// deal in the Work without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense,
// and/or sell copies of the Work, and to permit persons to whom the Work
// is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Work.
//
// THE WORK IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
// WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE WORK OR THE USE OR OTHER DEALINGS
// IN THE WORK.
//----------------------------------------------------------------------

// Load google maps and then call 'initialize'
google.maps.event.addDomListener(window, 'load', initialize);


// Once google is loaded, grab the topology data and draw the map
function initialize() {
    var url_params = getURLParameters();
    var center_lat = Number(url_params.lat) || 38.0;
    var center_lon = Number(url_params.lon) || -98.0;
    var zoom = Number(url_params.zoom) || 4;
    var map = initMap(zoom, center_lat, center_lon);
    // Make the map available globally
    window.map = map;

    var base_name = url_params.base_name || 'lwtesting_stitchtest';
    // Let the map show up, then paint the experiment data
    // momentarily (200 millis).
    setTimeout(makeGrabFunction(map, base_name, url_params), 200);
    setInterval(makeGrabFunction(map, base_name, url_params), 5 * 1000);
}

function makeGrabFunction(map, base_name, params) {
    return function() {
        $.getJSON('grab_visualization_data.php?base_name=' + base_name,
                  function(data) {
                      displayData(map, data, params);
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

function displayData(map, data, params) {
    map.geniMarkers || (map.geniMarkers = []);
    map.geniPaths || (map.geniPaths = []);
    var i;

    // Remove all previous markers and paths from map
    $.each(map.geniMarkers, function(i, marker) { marker.setMap(null); });
    map.geniMarkers = [];
    $.each(map.geniPaths, function(i, path) { path.setMap(null); });
    map.geniPaths = [];

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
    var lineWidth = Number(params.line_width) || 2;

    for(var i = 0; i < data.links.length; i++) {
        var link = data.links[i];
        from_node_id = link.from_id;
        to_node_id = link.to_id;
        var pathCoords = [
            getCoordsForNodeId(from_node_id, data),
            getCoordsForNodeId(to_node_id, data)
        ];
        var linkColor = 'yellow';
        if (link.status == "up") {
            linkColor = "green";
        } else if (link.status == "down") {
            linkColor = "gray";
        }
        var path = new google.maps.Polyline({
            path: pathCoords,
            geodesic: true,
            strokeColor : linkColor,
            strokeOpacity: 1.0,
            strokeWeight : lineWidth
        });
        path.setMap(map);
        map.geniPaths.push(path);
    }
}
