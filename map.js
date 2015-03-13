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
            node.addInterfaces(data.interfaces);
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
    this.interfaces = [];
};

gec.maps.Node.prototype.LatLng = function() {
    return this.site.latLng;
};

gec.maps.Node.prototype.addInterfaces = function(interfaces) {
    if (this.sender && this.sender in interfaces) {
        // Duplicate the list so we don't stomp on someone else.
        this.interfaces = interfaces[this.sender].slice();
    }
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
    var that = this;
    google.maps.event.addListener(marker, 'click',
                                  function(evt) {
                                      that.showChart(evt);
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
};

gec.maps.Link.prototype.showChart = function (event) {
    //console.log("show chart " + this.id + ": " + this.status);
    // What if this link's status is "down"? Pop up an alert?
    if ('kb' in event) {
        // this is a google map event, so grab the inner event
        event = event.kb;
    }
    var uid = chart_counter++;
    var idBase = "link" + this.id + "-" + uid;
    var chartType = "network";
    var senders = [];
    var chartTitle = "";
    if (this.fromNode.sender) {
        senders.push(this.fromNode.sender);
        chartTitle += this.fromNode.name;
    }
    if (this.toNode.sender) {
        senders.push(this.toNode.sender);
        if (chartTitle) {
            chartTitle += " & " + this.toNode.name;
        } else {
            chartTitle += this.toNode.name;
        }
    }
    senders = senders.join();
    chartTitle += " " + chartType;
    var chartOpts = {
        x: event.pageX,
        y: event.pageY,
        idBase: idBase,
        // FIXME: get node, then sender from node
        senders: senders,
        showXAxis: false,
        tablename: undefined,
        selectedMetrics: undefined,
        seconds: undefined,
        chartType: chartType,
        chartTitle: chartTitle
    };
    showMapChart(chartOpts);
};

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
    // 3/13: Do not scale site by num nodes. Assume square icons
//    var site_radius = 4 * this.nodes.length;
    var site_radius = 4;
    if (this.icon) {
	return {
	    url: this.icon,
	    anchor: new google.maps.Point(2*site_radius, 2*site_radius),
	    scaledSize: new google.maps.Size(4*site_radius,4*site_radius)
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
    this.marker = this.createMarker();
};

gec.maps.Site.prototype.createMarker = function() {
    var marker = new google.maps.Marker({
        position: this.latLng,
	icon: this.makeMarker(),
        title: this.name,
        map: this.map
    });

    // For the closure...
    var that = this;
    google.maps.event.addListener(marker, 'click',
                                  function(evt) {
                                      that.mapClick(evt);
                                  });
    return marker;
};

gec.maps.Site.prototype.mapClick = function() {
    var that = this;
    var outerDiv = $("<div/>");

    // Show the site name
    outerDiv.append($("<b/>", { text: this.name }));
    outerDiv.append($("<br/>"));

    var nodes = $.grep(this.nodes, function(n) { return n.sender; });

    if (nodes.length > 0) {

        // Add the chart node chooser
        var nodeSelector = $("<select/>");
        $.each(this.nodes, function(i, n) {
            var nodeOption = $("<option/>", {
                value: n.sender,
                text: n.name
            });
            nodeSelector.append(nodeOption);
        });
        outerDiv.append(nodeSelector);

        // Add the chart type chooser
        outerDiv.append($("<br/>"));
        var chartSelector = $("<select/>");
        $.each(["cpu", "memory", "network"],
               function(i, t) {
                   var chartOption = $("<option/>", {
                       value: t,
                       text: t
                   });
                   chartSelector.append(chartOption);
               });
        outerDiv.append(chartSelector);

        // Add the "Show Chart" link
        outerDiv.append($("<br/>"));
        var showLink = $("<a/>", {
            text: "Show Chart",
            href: "javascript:;"
        });
        outerDiv.append(showLink);

        var infowindow = new google.maps.InfoWindow();

        showLink.click(function(event) {
            console.log("site clicked " + that.name);
            that.showChart(event, nodeSelector, chartSelector);
            infowindow.close();
        });
        infowindow.setContent(outerDiv[0]);
    } else {
        outerDiv.append("<br/>").append("No nodes are reporting data");
        var infowindow = new google.maps.InfoWindow();
        infowindow.setContent(outerDiv[0]);
    }
    infowindow.open(this.map, this.marker);
};

/*
 * Add a node to a site.
 */
gec.maps.Site.prototype.addNode = function (node) {
    this.nodes.push(node);
};

gec.maps.Site.prototype.showChart = function(event, nodeSelector,
                                             chartSelector) {
    var site_id = this.id;
    var uid = chart_counter++;
    var idBase = "site" + site_id + "-" + uid;
    var chartType = chartSelector.val();
    var sender = nodeSelector.val();
    var nodeName = nodeSelector.children(':selected').text();
    var chartTitle = nodeName + " " + chartType;
    var chartOpts = {
        x: event.pageX,
        y: event.pageY,
        siteId: site_id,
        idBase: idBase,
        // FIXME: get node, then sender from node
        senders: sender,
        showXAxis: false,
        tablename: undefined,
        selectedMetrics: undefined,
        seconds: undefined,
        chartType: chartType,
        chartTitle: chartTitle
    };
    showMapChart(chartOpts);
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

    // Show the GENI, NSF and US Ignite logos
    var logosDiv = document.createElement('div-logos');
    logosDiv.innerHTML = '<image style="height: 30px; width: 30px" src="/common/geni.png"/>&nbsp;<image style="height: 30px; width: 30px" src="/common/nsf1.gif"/><image style="height: 30px; width: 110px" src="https://us-ignite-org.s3.amazonaws.com/static/v1/img/furniture/logo-small.png"/>';
    map.controls[google.maps.ControlPosition.BOTTOM_LEFT].push(logosDiv);

    var base_name = url_params.base_name || 'lwtesting_stitchtest';
    // Let the map show up, then paint the experiment data
    // momentarily (200 millis).
    setTimeout(makeInitFunction(map, base_name, url_params), 100);
}

function makeInitFunction(map, base_name, params) {
    return function() {
        $.getJSON('grab_visualization_data.php?base_name=' + base_name,
                  function(data) {
                      gec.maps.initData(data, map, base_name, params);
                  })
    };
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

function showMapChart(opts) {
    var element_id = "jq-" + opts.idBase;
    var chart_id = "chart-" + opts.idBase;
    var close_id = "close-" + opts.idBase;
    $("body").append("<div id='" + element_id
                     + "' class='ui-widget-content'>"
                     + "<a href='#' id='" + close_id + "'>x</a>"
                     + "<div id='" + chart_id + "'></div>"
                     + "</div>");
    // 'copts' is for closure of timeout function below
    var copts = opts;
    setTimeout(function() {
        var elementDiv = $("#" + element_id);
        var closeLink = $("#" + close_id);
        closeLink.click(function() {
            elementDiv.fadeOut(300, function() {elementDiv.remove()})});
        elementDiv.css({"position": "fixed",
                        "top": Number(copts.y || 0),
                        "left": Number(copts.x || 0),
                        "width": "300px",
                        "height": "150px"});
        elementDiv.draggable();
        //$("#" + element_id).resizable();
        drawVisualization(copts.chartType, copts.senders, copts.tablename,
                          // chart.js chokes on undefined
                          copts.selectedMetrics || "",
                          chart_id, copts.showXAxis, copts.seconds,
                          copts.chartTitle);
    }, 100);
}
