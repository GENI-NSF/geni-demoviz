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

// Strict mode - error undeclared variables
"use strict";

// Establish the geni namespace
var gec;
gec = gec || {};

// Establish the maps sub-namespace
gec.maps = {
    // Provide a UID for charts to allow multiple charts per node
    chart_counter: 0,

    // How many seconds between topology refreshes
    refreshSeconds: 5,

    allNodes: {},

    allLinks: {},

    allSites: {},

    getNode: function(id) {
        return this.allNodes[id];
    },

    addNode: function(node) {
        this.allNodes[node.id] = node;
        return node;
    },

    getLink: function(id) {
        return this.allLinks[id];
    },

    addLink: function(link) {
        this.allLinks[link.id] = link;
        return link;
    },

    getSite: function(id) {
        return this.allSites[id];
    },

    addSite: function(site) {
        this.allSites[site.id] = site;
        return site;
    },

    initData: function(data, map, base_name, params) {
        var sites = {};
        $.each(data.sites, function(i, s) {
            sites[s.id] = s;
        });

        var that = this;
        $.each(data.nodes, function(i, n) {
            var site = that.getSite(n.site_id)
                || that.addSite(new that.Site(sites[n.site_id], map));
            var node = new that.Node(n, site);
            gec.maps.addNode(node);
            site.addNode(node);
        });

        $.each(this.allSites, function(id, site) {
            site.updateMarker();
        });

        $.each(data.links, function(i, l) {
            var link = new that.Link(l, map, params.line_width);
            gec.maps.addLink(link);
        });

        // Update the data refreshSeconds from now
        setTimeout(this.makeUpdateFunction(map, base_name, params),
                   this.refreshSeconds * 1000);
    },

    updateData: function(data, map, base_name, params) {
        var that = this;
        $.each(data.links, function(i, l) {
            var link = that.getLink(l.id);
            link.update(l);
        });

        // Update the data refreshSeconds from now
        setTimeout(this.makeUpdateFunction(map, base_name, params),
                   this.refreshSeconds * 1000);
    },

    makeUpdateFunction: function(map, base_name, params) {
        return function() {
            $.getJSON('grab_visualization_data.php?base_name=' + base_name,
                      function(data) {
                          gec.maps.updateData(data, map, base_name, params);
                      })
        };
    }
};



/*----------------------------------------------------------------------
 * Node class
 *----------------------------------------------------------------------
 */
gec.maps.Node = function(data, site) {
    this.id = data.id;
    this.sender = data.sender;
    this.name = data.client_id;
    this.site = site;
};

gec.maps.Node.prototype.LatLng = function() {
    return this.site.latLng;
};

/*----------------------------------------------------------------------
 * Link class
 *----------------------------------------------------------------------
 */
gec.maps.Link = function(data, map, lineWidth) {
    this.id = data.id;
    this.fromNode = gec.maps.getNode(data.from_id);
    this.toNode = gec.maps.getNode(data.to_id);
    this.fromInterface = data.from_if_name;
    this.toInterface = data.to_if_name;
    this.status = data.status;
    this.map = map;
    this.lineWidth = lineWidth;
    this.marker = this.makeMarker();
    this.marker.setMap(this.map);
};

gec.maps.Link.prototype.color = function() {
    switch (this.status) {
    case "up":
        return "green";
    case "down":
        return "gray";
    default:
        return "yellow";
    }
};

gec.maps.Link.prototype.makeMarker = function () {
    var pathCoords = [
        this.fromNode.LatLng(),
        this.toNode.LatLng()
    ];
    var marker = new google.maps.Polyline({
        path: pathCoords,
        geodesic: true,
        strokeColor : this.color(),
        strokeOpacity: 1.0,
        strokeWeight : this.lineWidth
    });
    return marker;
};

gec.maps.Link.prototype.update = function (data) {
    if (this.status != data.status) {
        this.status = data.status;
        this.marker && this.marker.setMap(null);
        this.marker = this.makeMarker();
        this.marker.setMap(this.map);
    }
}


/*----------------------------------------------------------------------
 * Site class
 * ----------------------------------------------------------------------
 */
gec.maps.Site = function(data, map) {
    this.id = data.id;
    this.name = data.am_name;
    this.icon = data.icon;
    this.latLng = new google.maps.LatLng(data.latitude, data.longitude);
    this.map = map;
    this.nodes = [];
    this.marker = undefined;
};

gec.maps.Site.prototype.makeMarker = function () {
    var site_radius = 4 * this.nodes.length;
    if (this.icon) {
	return {
	    url: this.icon,
	    anchor: new google.maps.Point(2*site_radius, 2*site_radius),
	    scaledSize: new google.maps.Size(3*site_radius,3*site_radius)
	};
    } else {
        return {
            path: google.maps.SymbolPath.CIRCLE,
            scale: site_radius,
            strokeWeight: 1,
            //	strokeColor: "sienna"
        };
    }
}

gec.maps.Site.prototype.updateMarker = function () {
    // If there is a marker, remove it from the map.
    this.marker && this.marker.setMap(null);
    this.marker = createSiteMarker(this.map, this.id, this.nodes.length,
                                   this.latLng, this.makeMarker());
};

/*
 * Add a node to a site.
 */
gec.maps.Site.prototype.addNode = function (node) {
    this.nodes.push(node);
};


/*----------------------------------------------------------------------
 *
 * Old Code
 *
 *----------------------------------------------------------------------
 */

// Load google maps and then call 'initialize'
google.maps.event.addDomListener(window, 'load', initialize);

var chart_counter = 0;

// Once google is loaded, grab the topology data and draw the map
function initialize() {
    var url_params = getURLParameters();
    var center_lat = Number(url_params.lat || 38.0);
    var center_lon = Number(url_params.lon || -98.0);
    var zoom = Number(url_params.zoom) || 4;
    gec.maps.refreshSeconds = Number(url_params.refresh) || 5;
    var map = initMap(zoom, center_lat, center_lon);
    // Make the map available globally
    window.map = map;

    var base_name = url_params.base_name || 'lwtesting_stitchtest';
    // Let the map show up, then paint the experiment data
    // momentarily (200 millis).
    //setTimeout(makeGrabFunction(map, base_name, url_params), 1000);
    setTimeout(makeInitFunction(map, base_name, url_params), 100);
    //setInterval(makeGrabFunction(map, base_name, url_params), 5 * 1000);
}

function makeGrabFunction(map, base_name, params) {
    return function() {
        $.getJSON('grab_visualization_data.php?base_name=' + base_name,
                  function(data) {
                      displayData(data, map, base_name, params);
                  })
    };
}

function makeInitFunction(map, base_name, params) {
    return function() {
        $.getJSON('grab_visualization_data.php?base_name=' + base_name,
                  function(data) {
                      gec.maps.initData(data, map, base_name, params);
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

// Get icon for given site_id
function getIconForSiteId(site_id, data, site_count)
{
    var site = getSiteById(site_id, data);
    var site_radius = 4 * site_count;
//    if (site_radius < 6) {
//	site_radius = 6;
//    }
    if (typeof site.icon !== 'undefined' && site.icon !== 'null' && site.icon !== '') {
	return {
	    url: site.icon,
	    anchor: new google.maps.Point(2*site_radius, 2*site_radius),
	    scaledSize: new google.maps.Size(3*site_radius,3*site_radius)
	};
    }
	
//    var geni_image = 'geni_globe.png';
//    var micr_image = 'http://upload.wikimedia.org/wikipedia/commons/f/fe/Octicons-microscope.svg';
//    var geni_icon = {
//	url: geni_image,
//	anchor: new google.maps.Point(2*site_radius, 2*site_radius),
//	scaledSize: new google.maps.Size(3*site_radius,3*site_radius)
//    };
//    var micr_icon = {
//	url: micr_image,
//	anchor: new google.maps.Point(site_radius, 2*site_radius),
//	scaledSize: new google.maps.Size(2*site_radius,3*site_radius)
//    };
    var default_icon = {
        path: google.maps.SymbolPath.CIRCLE,
        scale: site_radius,
        strokeWeight: 1,
//	strokeColor: "sienna"
    };
//    if (site_id % 3 == 0) {
	return default_icon;
//    } else if (site_id % 2 == 0) {
//	return geni_icon;
//    } else {
//	return micr_icon;
//    }
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

function showMapChart(evt, site_id) {
    //console.log("click: " + evt.kb.x + ", " + evt.kb.y);
    var uid = chart_counter++;
    var element_id = "jq-" + site_id + uid;
    var chart_id = "chart-" + site_id + uid;
    var close_id = "close-" + site_id + uid;
    var chartTypes = ["memory", "cpu", "network"];
    var chartType = chartTypes[uid % chartTypes.length];
    $("body").append("<div id='" + element_id
                     + "' class='ui-widget-content'>"
                     + "<a href='#' id='" + close_id + "'>x</a>"
                     + "<div id='" + chart_id + "'></div>"
                     + "</div>");
    setTimeout(function() {
        var elementDiv = $("#" + element_id);
        var closeLink = $("#" + close_id);
        closeLink.click(function() {
            elementDiv.fadeOut(300, function() {elementDiv.remove()})});
        elementDiv.css({"position": "fixed",
                        "top": Math.floor(evt.kb.y),
                        "left": Math.floor(evt.kb.x),
                        "width": "300px",
                        "height": "150px"});
        elementDiv.draggable();
        //$("#" + element_id).resizable();
        var senders = "1";
        var tablename = "";
        var selected_metrics = "";
        var chartdiv = chart_id;
        var showXAxis = false;
        var seconds = undefined;
        var chartTitle = "";
        drawVisualization(chartType, senders, tablename, selected_metrics,
                          chartdiv, showXAxis, seconds, chartTitle);
    }, 100);
}

function createSiteMarker(map, site_id, site_count, site_coords, site_icon) {
    var title = site_id.toString();
    var marker = new google.maps.Marker({
        position: site_coords,
	icon: site_icon,
        title: title,
        map: map
    });
    var iw_text = "Site " + site_id + "<br/> "
        //+ '<a href="http://www.google.com/">google</a>'
        + '<img src="https://portal.geni.net/images/VM-noTxt-centered.svg"'
        + ' height="20" width="20" draggable="true"'
        + ' ondragstart="dragSite(event, ' + site_id + ')"'
        + '/>' ;
    var infowindow = new google.maps.InfoWindow({
        content: iw_text
    });
    google.maps.event.addListener(marker, 'click',
                                  function(evt) {
                                      showMapChart(evt, site_id);
                                  });
    return marker;
}

function displayData(data, map, base_name, params) {
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
        var n = new gec.maps.Node(data.nodes[i]);
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
        var site_icon = getIconForSiteId(site_id, data, site_count);
        map.geniMarkers.push(createSiteMarker(map, site_id, site_count,
                                              site_coords, site_icon));
    }

    // Draw links
    var lineWidth = Number(params.line_width) || 2;

    for(var i = 0; i < data.links.length; i++) {
        var link = data.links[i];
        var from_node_id = link.from_id;
        var to_node_id = link.to_id;
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
    setTimeout(makeGrabFunction(map, base_name, params),
               gec.maps.refreshSeconds * 1000);

}
