//----------------------------------------------------------------------
// Copyright (c) 2015 Raytheon BBN Technologies
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
var geni;
geni = geni || {};

// Establish the sites sub-namespace
geni.sites = {

    map: undefined,

    inCountries: undefined,

    outCountries: {},

    getNode: function(id) {
        return this.allNodes[id];
    },

    onLoad: function() {
        var url_params = getURLParameters();
        var center_lat = Number(url_params.lat || 38.0);
        var center_lon = Number(url_params.lon || -98.0);
        var zoom = Number(url_params.zoom) || 4;
        geni.sites.setFilters(url_params);
        geni.sites.map = geni.sites.initMap(zoom, center_lat, center_lon);
        $.getJSON('genisites.json', geni.sites.drawSites);
    },

    setFilters: function(url_params) {
        // Add these as properties so we can use the "in" syntax when
        // filtering.
        if (url_params.in) {
            geni.sites.inCountries = {};
            $.each(url_params.in.split(','), function(i, c) {
                geni.sites.inCountries[c] = undefined;
            });
        }
        if (url_params.out) {
            $.each(url_params.out.split(','), function(i, c) {
                geni.sites.outCountries[c] = undefined;
            });
        }
    },

    addSite: function(site) {
        if (site.country in geni.sites.outCountries) {
            // Never show countries on the out list.
            return;
        }
        if (geni.sites.inCountries) {
            // In countries are defined. Only show countries on the list.
            if (! (site.country in geni.sites.inCountries)) {
                // This country is not on the list.
                return;
            }
        }
        var marker = new google.maps.Marker({
            position: new google.maps.LatLng(site.latitude, site.longitude),
            title: site.name,
            icon: "http://maps.google.com/mapfiles/ms/icons/orange-dot.png",
            map: geni.sites.map,
        });
    },

    drawSites: function(data) {
        $.each(data, function(i, site) {
            geni.sites.addSite(site);
        });
    },

    initMap: function(zoom, center_lat, center_lon) {
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
};

// Load google maps and then call the load handler function
google.maps.event.addDomListener(window, 'load', geni.sites.onLoad);
