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

    chartTypeCPU: "CPU",
    chartTypeMemory: "Memory",
    chartTypeNetwork: "Network",
    chartOptionAll: "All",

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
    this.name = data.link_id.toString();
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
    case "internet":
        return "blue";
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
    if (this.status === "down") {
        alert("Network link " + this.name + " is down.");
        return;
    }
    var x, y;
    // Find the location, which might be buried inside a google maps event
    if ('pageX' in event) {
        x = event.pageX;
        y = event.pageY;
    } else {
        $.each(event, function(i,val) {
            if (val && 'pageX' in val) {
                x = val.pageX;
                y = val.pageY;
            }
        });
    }
    var uid = chart_counter++;
    var idBase = "link" + this.id + "-" + uid;
    var chartType = gec.maps.chartTypeNetwork;
    var senders = [];
    var interfaces = [];
    var chartTitle = this.name + " total bytes";
    if (this.toNode.sender) {
        senders.push(this.toNode.sender);
        interfaces.push(this.toInterface);
    } else if (this.fromNode.sender) {
        senders.push(this.fromNode.sender);
        interfaces.push(this.fromInterface);
    } else {
        alert("Network link " + this.name
              + " has no data available.");
        return;
    }
    senders = senders.join();
    interfaces = interfaces.join();
    var chartOpts = {
        x: x,
        y: y,
        idBase: idBase,
        senders: senders,
        interfaces: interfaces,
        showXAxis: false,
        tablename: undefined,
        selectedMetrics: "tot_bytes",
        seconds: undefined,
        chartType: chartType.toLowerCase(),
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
	    anchor: new google.maps.Point(6*site_radius, 6*site_radius),
	    scaledSize: new google.maps.Size(12*site_radius,12*site_radius)
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

gec.maps.Site.prototype.fillChartTypeSelect = function(chartSelector,
                                                       interfaceSelector) {
    var chartTypes = [gec.maps.chartTypeCPU, gec.maps.chartTypeMemory,
                      gec.maps.chartTypeNetwork];
    // Maybe add storage
    var url_params = getURLParameters();
    if (gec.maps.storage.storageEnabled(url_params.base_name)) {
        chartTypes.push(gec.maps.storage.chartTypeStorage);
    }
    $.each(chartTypes,
           function(i, t) {
               var chartOption = $("<option/>", {
                   value: t,
                   text: t
               });
               chartSelector.append(chartOption);
           });
    // For the change closure
    var ethSelector = interfaceSelector;
    chartSelector.change(function(event) {
        var select = $(this);
        var chosenText = select.children(':selected').text();
        if (chosenText === gec.maps.chartTypeNetwork) {
            ethSelector.prop('disabled', false);
        } else {
            ethSelector.prop('disabled', true);
        }
    });
}


gec.maps.Site.prototype.makeChartUI = function(parent) {
    // For the closure for inner functions
    var that = this;

    var nodeSelectorId = "node_selector";
    var chartSelectorId = "chart_selector";
    var interfaceSelectorId = "interface_selector";

    // Create the various drop down menus
    var nodeSelector = $("<select/>", { id: nodeSelectorId });
    var chartSelector = $("<select/>", { id: chartSelectorId });
    var interfaceSelector = $("<select/>", { disabled: true,
                                             id: interfaceSelectorId });

    // Populate the node selector
    if (this.nodes.length > 1) {
        // Add All if there is more than 1 node
        nodeSelector.append($("<option/>", { text: gec.maps.chartOptionAll }));
    }
    $.each(this.nodes, function(i, n) {
        var nodeOption = $("<option/>", {
            value: n.id,
            text: n.name
        });
        nodeSelector.append(nodeOption);
    });
    nodeSelector.change(function(event) {
        var select = $(this);
        var nodeId = select.children(':selected').prop("value");
        var interfaces = undefined;
        if (nodeId === gec.maps.chartOptionAll) {
            interfaces = that.allInterfaces();
        } else {
            var node = gec.maps.getNode(nodeId);
            interfaces = node.interfaces;
        }
        if (interfaces.length > 0) {
            interfaceSelector.empty();
            // If length is greater than 1, add All
            // otherwise just add the single interface and skip "All"
            if (interfaces.length > 1) {
                interfaceSelector.append($("<option/>",
                                           { text: gec.maps.chartOptionAll }
                                          ));
            }
            $.each(interfaces, function(idx, iface) {
                interfaceSelector.append($("<option/>", { text: iface }));
            });
            var chartType = chartSelector.children(':selected').text();
            if (chartType === gec.maps.chartTypeNetwork) {
                interfaceSelector.prop('disabled', false);
            }
        } else {
            // disable the interfaceSelector
            interfaceSelector.empty();
            interfaceSelector.prop('disabled', true);
        }
    });

    // Populate the chart type selector
    this.fillChartTypeSelect(chartSelector, interfaceSelector);

    // Populate the interface selector
    var interfaceOption = $("<option/>", { text: gec.maps.chartOptionAll });
    interfaceSelector.append(interfaceOption);

    // Add the "Show Chart" link
    var showLink = $("<a/>", {
        text: "Show Chart",
        href: "javascript:;"
    });

    parent.append($("<label/>", { text: "Node: ",
                                  for: nodeSelectorId }));
    parent.append(nodeSelector);
    parent.append($("<br/>"));
    parent.append($("<label/>", { text: "Chart: ",
                                  for: chartSelectorId }));
    parent.append(chartSelector);
    parent.append($("<br/>"));
    parent.append($("<label/>", { text: "Interface: ",
                                  for: interfaceSelectorId }));
    parent.append(interfaceSelector);
    parent.append($("<br/>"));

    parent.append(showLink);
    // Call the change handler to get the right items in the interfaceSelector.
    nodeSelector.change();

    var infowindow = new google.maps.InfoWindow();

    showLink.click(function(event) {
        that.showChart(event, nodeSelector, chartSelector, interfaceSelector);
        infowindow.close();
    });
    infowindow.setContent(parent[0]);
    return infowindow;
};

gec.maps.Site.prototype.mapClick = function() {
    var outerDiv = $("<div/>");

    // Show the site name
    outerDiv.append($("<b/>", { text: this.name }));
    outerDiv.append($("<br/>"));

    var nodesWithSenders = $.grep(this.nodes, function(n) { return n.sender; });
    if (nodesWithSenders.length > 0) {
        var infowindow = this.makeChartUI(outerDiv);
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

/*
 * Given node, chart, and interface selections, generate the correct
 * lists of senders and interfaces.
 */
gec.maps.Site.prototype.chartSendersAndInterfaces = function(node,
                                                             chart,
                                                             iface,
                                                             senders,
                                                             interfaces) {
    
    if (chart === gec.maps.chartTypeCPU || chart == gec.maps.chartTypeMemory) {
        if (node === gec.maps.chartOptionAll) {
            $.each(this.nodes, function(i, n) {
                if (n.sender) {
                    senders.push(n.sender);
                }
            });
        } else {
            var n = gec.maps.getNode(node);
            if (n && n.sender) {
                senders.push(gec.maps.getNode(node).sender);
            }
        }
        return;
    }
    // It must be a network chart...
    var nodes = [];
    if (node === gec.maps.chartOptionAll) {
        nodes = this.nodes;
    } else {
        nodes.push(gec.maps.getNode(node));
    }
    $.each(nodes, function(i, n) {
        if (! n.sender) return;
        if (iface === gec.maps.chartOptionAll) {
            $.each(n.interfaces, function(idx, ifc) {
                senders.push(n.sender);
                interfaces.push(ifc);
            });
        } else {
            if ($.inArray(iface, n.interfaces) !== -1) {
                senders.push(n.sender);
                interfaces.push(iface);
            }
        }
    });
};

gec.maps.Site.prototype.showChart = function(event, nodeSelector,
                                             chartSelector, interfaceSelector) {
    var site_id = this.id;
    var uid = chart_counter++;
    var idBase = "site" + site_id + "-" + uid;
    var chartType = chartSelector.val();
    var nodeId = nodeSelector.val();
    var iface = interfaceSelector.val();
    var node = gec.maps.getNode(nodeId);
    var senders = []
    var interfaces = []
    var selectedMetrics = undefined;
    var tablename = undefined;
    if (chartType === gec.maps.chartTypeNetwork) {
        selectedMetrics = "tot_bytes";
    }
    if (chartType === gec.maps.storage.chartTypeStorage) {
        gec.maps.storage.senders(this, nodeId, senders);
        tablename = gec.maps.storage.tablename;
        selectedMetrics = "used_storage";
    } else {
        this.chartSendersAndInterfaces(nodeId, chartType, iface, senders,
                                       interfaces);
    }
    if (senders.length === 0) {
        var msg = "No " + chartType.toLowerCase() + " data available for";
        if (nodeId === gec.maps.chartOptionAll) {
            msg += " site " + this.name + "."
        } else {
            msg += " node " + node.name + ".";
        }
        alert(msg);
        return;
    }
    var nodeName = nodeSelector.children(':selected').text();
    var chartTitle = "";
    if (nodeName === gec.maps.chartOptionAll) {
        chartTitle = "Site " + this.name + " " + chartType;
    } else {
        var ifs = interfaces.join(', ');
        chartTitle = this.name + " " + nodeName + " " + ifs + " " + chartType;
    }
    if (chartType === gec.maps.storage.chartTypeStorage) {
        chartType = "generic";
    }
    var chartOpts = {
        x: event.pageX,
        y: event.pageY,
        siteId: site_id,
        idBase: idBase,
        senders: senders.join(),
        interfaces: interfaces.join(),
        showXAxis: false,
        tablename: tablename,
        selectedMetrics: selectedMetrics,
        seconds: undefined,
        chartType: chartType.toLowerCase(),
        chartTitle: chartTitle
    };
    showMapChart(chartOpts);
};

/*
 * Get a list of all network interfaces on all nodes at this
 * site. There will be no duplicates in this list. An empty set
 * indicates either no nodes are present at this site, or no
 * interfaces are present on any of the nodes.
 */
gec.maps.Site.prototype.allInterfaces = function () {
    var interfaces = [];
    $.each(this.nodes, function(i, n) {
        $.each(n.interfaces, function(idx, ifc) {
            if ($.inArray(ifc, interfaces) === -1) {
                interfaces.push(ifc);
            }
        });
    });
    return interfaces;
};

/*----------------------------------------------------------------------
 *
 * Special for storage data type for sdxsmall
 *
 *----------------------------------------------------------------------
 */
gec.maps.storage = {

    chartTypeStorage: "Storage",

    storageBasenames: [ "sdxsmall" ],

    tablename: "nriganikytopo2",

    storageSenders: {
        55: "nriga-nikytopo2-cenic-server",
        56: "nriga-nikytopo2-max-sdx-comp",
        57: "nriga-nikytopo2-max-sdx",
        58: "nriga-nikytopo2-iminds2-sdx",
        59: "nriga-nikytopo2-iminds-client",
        60: "nriga-nikytopo2-usclients",
        61: "nriga-nikytopo2-clabfake",
        62: "nriga-nikytopo2-iminds2-sdx-comp",
        64: "nriga-nikytopo2-aws"
    },

    storageEnabled: function(basename) {
        return ($.inArray(basename, this.storageBasenames) !== -1);
    },

    senders: function(site, nodeId, senders) {
        var nodes = site.nodes;
        if (nodeId !== gec.maps.chartOptionAll) {
            nodes = [ gec.maps.getNode(nodeId) ];
        }
        var that = this;
        $.each(nodes, function(i,n) {
            if (n.sender) {
                var storageSender = that.storageSenders[n.sender];
                if (storageSender) {
                    senders.push(storageSender);
                }
            }
        });
    }
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
    gec.maps.refreshSeconds = (Number(url_params.refresh)
                               || gec.maps.refreshSeconds);
    var map = initMap(zoom, center_lat, center_lon);
    // Make the map available globally
    window.map = map;

    // Show the GENI, NSF and US Ignite logos
    var logosDiv = document.createElement('div-logos');
    // 
    // Orig
    //    logosDiv.innerHTML = '<image style="height: 30px; width: 30px" src="/common/geni.png"/>&nbsp;<image style="height: 30px; width: 30px" src="/common/nsf1.gif"/><image style="height: 30px; width: 110px" src="https://us-ignite-org.s3.amazonaws.com/static/v1/img/furniture/logo-small.png"/>';
    // From Niky
    logosDiv.innerHTML = '<image style="height: 100px" src="http://www.gpolab.bbn.com/experiment-support/logos/left.png"/>&nbsp;<image style="height: 100px" src="http://www.gpolab.bbn.com/experiment-support/logos/middle.png"/><image style="height: 100px" src="http://www.gpolab.bbn.com/experiment-support/logos/right.png"/>';
    map.controls[google.maps.ControlPosition.TOP_LEFT].push(logosDiv);

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
                     + "' class='chart-container ui-widget-content'>"
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
                          copts.chartTitle, copts.interfaces);
    }, 100);
}
